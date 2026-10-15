package ru.citypulse.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.dto.LoginRequest;
import ru.citypulse.backend.dto.RegisterRequest;
import ru.citypulse.backend.repository.UserRepository;
import ru.citypulse.backend.security.JwtService;

@Service
@RequiredArgsConstructor
public class AuthService {
  private final UserRepository users;
  private final PasswordEncoder encoder;
  private final JwtService jwt;

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
}
