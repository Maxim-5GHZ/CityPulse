package ru.citypulse.backend.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.citypulse.backend.domain.DistrictScenario;
import ru.citypulse.backend.repository.DistrictScenarioRepository;

/**
 * Сценарии конструктора «Обнинск 2040» (привязка workspace к бэку).
 * Храним DistrictState целиком в JSONB — честный Dijkstra считается на фронте
 * мгновенно, бэк отвечает только за сохранение/загрузку/удаление.
 * Всё по владельцу (email из JWT), чужие сценарии недоступны.
 * Правило e2e: раз есть POST — обязан быть DELETE (чистка за собой на общей базе).
 */
@RestController
@RequestMapping("/api/scenarios")
@RequiredArgsConstructor
public class ScenarioController {
  private final DistrictScenarioRepository scenarios;

  @Data
  public static class ScenarioRow {
    private final UUID id;
    private final String name;
    private final String payload;
    private final OffsetDateTime updatedAt;
  }

  @Data
  public static class SaveScenarioRequest {
    @NotBlank(message = "Название сценария обязательно")
    @Size(max = 120, message = "Название — до 120 символов")
    private String name;

    @NotBlank(message = "Состояние района обязательно")
    private String payload;
  }

  private static ScenarioRow row(DistrictScenario s) {
    return new ScenarioRow(s.getId(), s.getName(), s.getPayload(), s.getUpdatedAt());
  }

  @GetMapping
  public ResponseEntity<List<ScenarioRow>> list(Authentication auth) {
    return ResponseEntity.ok(scenarios.findAllByOwnerEmailOrderByUpdatedAtDesc(auth.getName())
        .stream().map(ScenarioController::row).toList());
  }

  @GetMapping("/{id}")
  public ResponseEntity<ScenarioRow> get(
      Authentication auth, @PathVariable UUID id) {
    return scenarios.findByIdAndOwnerEmail(id, auth.getName())
        .map(s -> ResponseEntity.ok(row(s)))
        .orElseThrow(() -> new NoSuchElementException("Сценарий не найден"));
  }

  @PostMapping
  @Transactional
  public ResponseEntity<ScenarioRow> create(
      Authentication auth, @Valid @RequestBody SaveScenarioRequest req) {
    if (req.getPayload().length() > 500_000) {
      throw new IllegalArgumentException("Сценарий слишком большой");
    }
    DistrictScenario s = scenarios.save(DistrictScenario.builder()
        .ownerEmail(auth.getName())
        .name(req.getName().trim())
        .payload(req.getPayload())
        .build());
    return ResponseEntity.ok(row(s));
  }

  @PutMapping("/{id}")
  @Transactional
  public ResponseEntity<ScenarioRow> update(
      Authentication auth, @PathVariable UUID id, @Valid @RequestBody SaveScenarioRequest req) {
    DistrictScenario s = scenarios.findByIdAndOwnerEmail(id, auth.getName())
        .orElseThrow(() -> new NoSuchElementException("Сценарий не найден"));
    s.setName(req.getName().trim());
    s.setPayload(req.getPayload());
    return ResponseEntity.ok(row(scenarios.save(s)));
  }

  @DeleteMapping("/{id}")
  @Transactional
  public ResponseEntity<Map<String, String>> delete(Authentication auth, @PathVariable UUID id) {
    DistrictScenario s = scenarios.findByIdAndOwnerEmail(id, auth.getName())
        .orElseThrow(() -> new NoSuchElementException("Сценарий не найден"));
    scenarios.delete(s);
    return ResponseEntity.ok(Map.of("deleted", s.getName()));
  }
}
