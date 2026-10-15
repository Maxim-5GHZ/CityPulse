package ru.citypulse.backend.controller;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Проверки живости. Публичные (см. SecurityConfig) — их дёргает фронт
 * на главной и docker healthcheck.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HealthController {

  private final JdbcTemplate jdbc;

  @GetMapping("/health")
  public ResponseEntity<Map<String, String>> health() {
    return ResponseEntity.ok(Map.of("status", "OK"));
  }

  /** Доказательство, что бэкенд реально коннектится к БД: SELECT 1 + версия Postgres. */
  @GetMapping("/db")
  public ResponseEntity<Map<String, Object>> db() {
    Integer one = jdbc.queryForObject("SELECT 1", Integer.class);
    String version = jdbc.queryForObject("SELECT version()", String.class);
    return ResponseEntity.ok(Map.of("select1", one == null ? 0 : one, "postgres", version == null ? "?" : version));
  }
}
