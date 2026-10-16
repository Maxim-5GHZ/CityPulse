package ru.citypulse.backend.controller;

import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.citypulse.backend.dto.FlidaExchangeRequest;
import ru.citypulse.backend.dto.LoginRequest;
import ru.citypulse.backend.dto.RegisterRequest;
import ru.citypulse.backend.service.AuthService;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
  private final AuthService authService;

  @PostMapping("/register")
  public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest req) {
    return ResponseEntity.ok(Map.of("token", authService.register(req)));
  }

  @PostMapping("/login")
  public ResponseEntity<Map<String, String>> login(@Valid @RequestBody LoginRequest req) {
    return ResponseEntity.ok(Map.of("token", authService.login(req)));
  }

  /**
   * Вход через Флида ID в схеме Web SDK: фронт сам проходит OIDC (state/PKCE/обмен
   * кода — в браузере, секрета нет), сюда присылает Flida access_token.
   * Бэкенд перепроверяет его через userinfo сервер-сервер и отдаёт наш JWT.
   */
  @PostMapping("/flida")
  public ResponseEntity<Map<String, String>> flida(@Valid @RequestBody FlidaExchangeRequest req) {
    return ResponseEntity.ok(Map.of("token", authService.exchangeFlida(req.getAccessToken())));
  }
}
