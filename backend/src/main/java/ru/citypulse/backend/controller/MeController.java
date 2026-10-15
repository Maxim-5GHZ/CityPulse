package ru.citypulse.backend.controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Пример защищённого эндпоинта: сюда пускает только с валидным JWT. */
@RestController
@RequestMapping("/api/me")
public class MeController {

  @GetMapping
  public ResponseEntity<Map<String, String>> me(Authentication auth) {
    String role = auth.getAuthorities().stream()
        .map(Object::toString)
        .map(s -> s.startsWith("ROLE_") ? s.substring(5) : s)
        .findFirst()
        .orElse("USER");
    return ResponseEntity.ok(Map.of("email", auth.getName(), "role", role));
  }
}
