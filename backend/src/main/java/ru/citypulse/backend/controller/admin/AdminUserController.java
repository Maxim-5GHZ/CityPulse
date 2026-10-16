package ru.citypulse.backend.controller.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.repository.UserRepository;

/**
 * Админский CRUD пользователей. Все пути под /api/admin/** (только ROLE_ADMIN).
 * Шаблон для новых сущностей: скопируй контроллер, замени User на свою @Entity.
 * Правило e2e: раз есть POST — обязан быть DELETE (чистка за собой на общей базе).
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
  private final UserRepository users;
  private final PasswordEncoder encoder;

  @Data
  public static class UserRow {
    private final UUID id;
    private final String email;
    private final String role;
    private final OffsetDateTime createdAt;
  }

  @Data
  public static class CreateUserRequest {
    @NotBlank(message = "Email обязателен")
    @Email(message = "Некорректный email")
    private String email;
    @NotBlank(message = "Пароль обязателен")
    @Size(min = 6, max = 128, message = "Пароль — от 6 до 128 символов")
    private String password;
    @Pattern(regexp = "USER|ADMIN", message = "Роль — USER или ADMIN")
    private String role = "USER";
  }

  @Data
  public static class RoleRequest {
    @Pattern(regexp = "USER|ADMIN", message = "Роль — USER или ADMIN")
    @NotBlank(message = "Роль обязательна")
    private String role;
  }

  private static UserRow row(User u) {
    return new UserRow(u.getId(), u.getEmail(), u.getRole(), u.getCreatedAt());
  }

  @GetMapping
  public ResponseEntity<List<UserRow>> list() {
    return ResponseEntity.ok(users.findAll().stream().map(AdminUserController::row).toList());
  }

  @PostMapping
  @Transactional
  public ResponseEntity<UserRow> create(@Valid @RequestBody CreateUserRequest req) {
    String email = req.getEmail().toLowerCase().trim();
    if (users.findByEmail(email).isPresent()) {
      throw new IllegalArgumentException("Пользователь уже существует: " + email);
    }
    User u = users.save(User.builder()
        .email(email)
        .role(req.getRole() == null ? "USER" : req.getRole())
        .passwordHash(encoder.encode(req.getPassword()))
        .build());
    return ResponseEntity.ok(row(u));
  }

  @PatchMapping("/{id}/role")
  @Transactional
  public ResponseEntity<UserRow> setRole(
      Authentication auth, @PathVariable UUID id, @Valid @RequestBody RoleRequest req) {
    User u = users.findById(id)
        .orElseThrow(() -> new NoSuchElementException("Пользователь не найден"));
    if (u.getEmail().equalsIgnoreCase(auth.getName()) && !"ADMIN".equals(req.getRole())) {
      throw new IllegalArgumentException("Нельзя снять ADMIN с самого себя");
    }
    u.setRole(req.getRole());
    return ResponseEntity.ok(row(users.save(u)));
  }

  @DeleteMapping("/{id}")
  @Transactional
  public ResponseEntity<Map<String, String>> delete(Authentication auth, @PathVariable UUID id) {
    User u = users.findById(id)
        .orElseThrow(() -> new NoSuchElementException("Пользователь не найден"));
    if (u.getEmail().equalsIgnoreCase(auth.getName())) {
      throw new IllegalArgumentException("Нельзя удалить самого себя");
    }
    if ("ADMIN".equals(u.getRole()) && users.findAll().stream()
        .filter(x -> "ADMIN".equals(x.getRole())).count() <= 1) {
      throw new IllegalArgumentException("Нельзя удалить последнего администратора");
    }
    users.delete(u);
    return ResponseEntity.ok(Map.of("deleted", u.getEmail()));
  }
}
