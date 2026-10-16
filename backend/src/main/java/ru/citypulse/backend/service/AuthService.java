package ru.citypulse.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import ru.citypulse.backend.config.FlidaProps;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.dto.LoginRequest;
import ru.citypulse.backend.dto.RegisterRequest;
import ru.citypulse.backend.repository.UserRepository;
import ru.citypulse.backend.security.JwtService;

@Service
@RequiredArgsConstructor
public class AuthService {
  private static final Logger log = LoggerFactory.getLogger(AuthService.class);
  private final UserRepository users;
  private final PasswordEncoder encoder;
  private final JwtService jwt;
  private final FlidaProps flidaProps;

  private final RestTemplate http = new RestTemplate();
  private final ObjectMapper json = new ObjectMapper();

  @Transactional
  public String register(RegisterRequest req) {
    String email = req.getEmail().toLowerCase().trim();
    if (users.findByEmail(email).isPresent()) {
      throw new IllegalArgumentException("Пользователь уже существует: " + email);
    }
    User u = User.builder()
        .email(email)
        .role("USER")
        .passwordHash(encoder.encode(req.getPassword()))
        .build();
    users.save(u);
    return jwt.generate(email, "USER");
  }

  @Transactional(readOnly = true)
  public String login(LoginRequest req) {
    User u = users.findByEmail(req.getEmail().toLowerCase().trim())
        .orElseThrow(() -> new IllegalArgumentException("Неверный email или пароль"));
    if (!encoder.matches(req.getPassword(), u.getPasswordHash())) {
      throw new IllegalArgumentException("Неверный email или пароль");
    }
    return jwt.generate(u.getEmail(), u.getRole() == null ? "USER" : u.getRole());
  }

  /**
   * Обмен Flida access_token (добыт Web SDK во фронте) на наш JWT.
   * Токен не доверяем вслепую: идём в userinfo сервер-сервер с Bearer,
   * дальше та же привязка, что была у confidential-клиента:
   * flida_sub → тот же email → создать без пароля.
   */
  @Transactional
  public String exchangeFlida(String flidaAccessToken) {
    if (flidaAccessToken == null || flidaAccessToken.isBlank()) {
      throw new IllegalArgumentException("Нет токена Флида ID");
    }
    JsonNode info = fetchUserinfo(flidaAccessToken.trim());
    String sub = text(info, "sub");
    String email = text(info, "email");
    boolean emailVerified = !info.has("email_verified") || info.get("email_verified").asBoolean(true);
    log.info(
        "flida exchange: subPresent={} emailPresent={} emailVerified={}",
        sub != null && !sub.isBlank(),
        email != null && !email.isBlank(),
        emailVerified);
    if (sub == null || sub.isBlank() || email == null || email.isBlank()) {
      throw new IllegalArgumentException("Флида ID не отдал email, вход невозможен");
    }
    if (!emailVerified) {
      throw new IllegalArgumentException("Email во Флида ID не подтверждён");
    }
    String normalized = email.toLowerCase().trim();
    User u = users.findByFlidaSub(sub).orElseGet(() -> users.findByEmail(normalized)
        .map(existing -> {
          existing.setFlidaSub(sub);
          return users.save(existing);
        })
        .orElseGet(() -> users.save(User.builder()
            .email(normalized)
            .role("USER")
            .passwordHash(null)
            .flidaSub(sub)
            .build())));
    return jwt.generate(u.getEmail(), u.getRole() == null ? "USER" : u.getRole());
  }

  private JsonNode fetchUserinfo(String accessToken) {
    HttpHeaders h = new HttpHeaders();
    h.setBearerAuth(accessToken);
    h.setAccept(List.of(MediaType.APPLICATION_JSON));
    try {
      ResponseEntity<String> res =
          http.exchange(flidaProps.getUserinfoUri(), HttpMethod.GET, new HttpEntity<>(h), String.class);
      if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
        return json.readTree(res.getBody());
      }
      log.warn("flida userinfo: status={}", res.getStatusCode());
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      log.warn("flida userinfo fetch failed: uri={} err={}", flidaProps.getUserinfoUri(), e.toString());
    }
    throw new IllegalArgumentException("Не удалось проверить токен Флида ID");
  }

  private static String text(JsonNode node, String field) {
    JsonNode v = node == null ? null : node.get(field);
    return v == null || v.isNull() ? null : v.asText();
  }
}
