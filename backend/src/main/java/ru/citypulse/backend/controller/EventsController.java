package ru.citypulse.backend.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.UUID;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import ru.citypulse.backend.security.JwtService;
import ru.citypulse.backend.service.SseHub;

/**
 * SSE-лента событий. Подписка — GET /api/events/stream?token=JWT:
 * нативный EventSource не умеет Authorization-header, поэтому токен в query
 * (осознанный tradeoff для хакатона; в проде — cookie). Отправка — только ADMIN.
 */
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventsController {
  private final SseHub hub;
  private final JwtService jwt;

  @GetMapping("/stream")
  public SseEmitter stream(@RequestParam("token") String token) {
    String email;
    try {
      email = jwt.parseEmail(token);
    } catch (Exception e) {
      throw new IllegalArgumentException("Недействительный токен подписки");
    }
    return hub.subscribe(email + ":" + UUID.randomUUID());
  }

  @Data
  public static class BroadcastRequest {
    @NotBlank(message = "Сообщение не должно быть пустым")
    private String message;
  }

  /** Только ADMIN (см. SecurityConfig /api/admin/**) — ручка лежит под /api/events/admin. */
  @PostMapping("/admin/broadcast")
  public ResponseEntity<Map<String, Object>> broadcast(
      Authentication auth, @Valid @RequestBody BroadcastRequest req) {
    boolean isAdmin = auth.getAuthorities().stream()
        .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    if (!isAdmin) {
      throw new org.springframework.security.access.AccessDeniedException("Только для администратора");
    }
    int sent = hub.broadcast("message",
        Map.of("text", req.getMessage(), "from", auth.getName()));
    return ResponseEntity.ok(Map.of("sent", sent, "clients", hub.clientCount()));
  }
}
