package ru.citypulse.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import ru.citypulse.backend.config.FlidaProps;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.repository.UserRepository;
import ru.citypulse.backend.security.JwtService;

/**
 * Вход через Флида ID, confidential-клиент: весь обмен идёт сервер-сервер,
 * client_secret за пределы бэкенда не выходит, фронт про Флиду ничего не знает.
 */
@Service
@RequiredArgsConstructor
public class FlidaService {
  private final UserRepository users;
  private final JwtService jwt;
  private final FlidaProps props;

  private final RestTemplate http = new RestTemplate();
  private final ObjectMapper json = new ObjectMapper();
  private final SecureRandom random = new SecureRandom();
  // state -> verifier. Одноинстансный стор: для хакатона ок, на N реплик не разъедется.
  private final ConcurrentHashMap<String, PendingLogin> pending = new ConcurrentHashMap<>();

  private record PendingLogin(String verifier, long expiresAt) {}

  public boolean configured() {
    return props.getClientId() != null && !props.getClientId().isBlank()
        && props.getClientSecret() != null && !props.getClientSecret().isBlank();
  }

  /** URL, куда слать браузер: Флида покажет свой логин и вернёт код на наш redirect_uri. */
  public String buildLoginUrl() {
    if (!configured()) {
      throw new IllegalStateException("Вход через Флида ID не настроен");
    }
    String state = randomString(24);
    String verifier = randomString(64);
    pending.put(state, new PendingLogin(verifier, System.currentTimeMillis() + Duration.ofMinutes(15).toMillis()));
    return UriComponentsBuilder.fromUriString(props.getAuthorizeUri())
        .queryParam("response_type", "code")
        .queryParam("client_id", props.getClientId())
        .queryParam("redirect_uri", props.getRedirectUri())
        .queryParam("code_challenge", challenge(verifier))
        .queryParam("code_challenge_method", "S256")
        .queryParam("state", state)
        .build(true)
        .toUriString();
  }

  /** Обмен code -> токены -> userinfo -> наш JWT. Одноразово: state сгорает при первом использовании. */
  @Transactional
  public String handleCallback(String code, String state) {
    PendingLogin p = pending.remove(state);
    if (p == null || p.expiresAt() < System.currentTimeMillis()) {
      throw new IllegalArgumentException("Сессия входа истекла или неверна, попробуй ещё раз");
    }
    JsonNode info = userinfo(exchangeCode(code, p.verifier()));
    String sub = text(info, "sub");
    String email = text(info, "email");
    if (sub == null || sub.isBlank() || email == null || email.isBlank()) {
      throw new IllegalArgumentException("Флида ID не отдал email, вход невозможен");
    }
    if (info.has("email_verified") && !info.get("email_verified").asBoolean(true)) {
      throw new IllegalArgumentException("Email во Флида ID не подтверждён");
    }
    String normalized = email.toLowerCase().trim();
    User u = users.findByFlidaSub(sub).orElseGet(() -> linkOrCreate(sub, normalized));
    return jwt.generate(u.getEmail(), u.getRole() == null ? "USER" : u.getRole());
  }

  /** Тот же email уже регистрировался паролем — цепляем flida_sub к нему, иначе создаём без пароля. */
  private User linkOrCreate(String sub, String email) {
    return users.findByEmail(email)
        .map(existing -> {
          existing.setFlidaSub(sub);
          return users.save(existing);
        })
        .orElseGet(() -> users.save(User.builder()
            .email(email)
            .role("USER")
            .passwordHash(null)
            .flidaSub(sub)
            .build()));
  }

  private String exchangeCode(String code, String verifier) {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("grant_type", "authorization_code");
    form.add("code", code);
    form.add("redirect_uri", props.getRedirectUri());
    form.add("client_id", props.getClientId());
    form.add("client_secret", props.getClientSecret());
    form.add("code_verifier", verifier);
    HttpHeaders h = new HttpHeaders();
    h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
    h.setAccept(List.of(MediaType.APPLICATION_JSON));
    try {
      ResponseEntity<String> res = http.postForEntity(props.getTokenUri(), new HttpEntity<>(form, h), String.class);
      if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
        String at = text(json.readTree(res.getBody()), "access_token");
        if (at != null && !at.isBlank()) {
          return at;
        }
      }
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      // ниже — общая ошибка обмена
    }
    throw new IllegalArgumentException("Флида ID не обменял код на токены");
  }

  private JsonNode userinfo(String accessToken) {
    HttpHeaders h = new HttpHeaders();
    h.setBearerAuth(accessToken);
    h.setAccept(List.of(MediaType.APPLICATION_JSON));
    try {
      ResponseEntity<String> res =
          http.exchange(props.getUserinfoUri(), HttpMethod.GET, new HttpEntity<>(h), String.class);
      if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
        return json.readTree(res.getBody());
      }
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      // ниже — общая ошибка профиля
    }
    throw new IllegalArgumentException("Не удалось получить профиль Флида ID");
  }

  private static String text(JsonNode node, String field) {
    JsonNode v = node == null ? null : node.get(field);
    return v == null || v.isNull() ? null : v.asText();
  }

  private String randomString(int bytes) {
    byte[] b = new byte[bytes];
    random.nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  private static String challenge(String verifier) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256")
          .digest(verifier.getBytes(StandardCharsets.US_ASCII));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    } catch (Exception e) {
      throw new IllegalStateException("SHA-256 недоступен", e);
    }
  }
}
