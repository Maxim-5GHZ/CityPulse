package ru.citypulse.backend.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.repository.UserRepository;

/** Сид админа на старте: берёт APP_ADMIN_EMAIL/PASSWORD из .env. Пустой email = не создавать. */
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements CommandLineRunner {
  private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

  private final UserRepository users;
  private final PasswordEncoder encoder;

  @Value("${app.admin-email:}")
  private String adminEmail;

  @Value("${app.admin-password:admin}")
  private String adminPassword;

  @Override
  public void run(String... args) {
    if (adminEmail == null || adminEmail.isBlank()) {
      return;
    }
    String email = adminEmail.toLowerCase().trim();
    if (users.findByEmail(email).isPresent()) {
      return;
    }
    users.save(User.builder().email(email).role("ADMIN")
        .passwordHash(encoder.encode(adminPassword)).build());
    if ("admin".equals(adminPassword)) {
      log.warn("Создан админ {}/admin — задайте APP_ADMIN_PASSWORD в .env!", email);
    } else {
      log.info("Создан администратор {}", email);
    }
  }
}
