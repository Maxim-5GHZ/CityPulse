package ru.citypulse.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.citypulse.backend.domain.Scenario;
import ru.citypulse.backend.service.ScenarioService;

/**
 * Кейс 03: CRUD проектов конструктора. Все пути требуют JWT (см. SecurityConfig),
 * владелец берётся из токена. Правило e2e: раз есть POST — обязан быть DELETE.
 */
@RestController
@RequestMapping("/api/scenarios")
@RequiredArgsConstructor
public class ScenarioController {
  private final ScenarioService scenarios;

  @Data
  public static class ScenarioRow {
    private final UUID id;
    private final String name;
    private final OffsetDateTime updatedAt;
  }

  @Data
  public static class ScenarioDetail {
    private final UUID id;
    private final String name;
    private final JsonNode graph;
    private final String hash;
    private final OffsetDateTime updatedAt;
  }

  @Data
  public static class CreateScenarioRequest {
    @NotBlank(message = "Название проекта обязательно")
    @Size(max = 120, message = "Название проекта — до 120 символов")
    private String name;
    @NotNull(message = "Нет графа проекта")
    private JsonNode graph;
  }

  @Data
  public static class UpdateScenarioRequest {
    @Size(max = 120, message = "Название проекта — до 120 символов")
    private String name;
    private JsonNode graph;
  }

  private static ScenarioRow row(Scenario s) {
    return new ScenarioRow(s.getId(), s.getName(), s.getUpdatedAt());
  }

  private static ScenarioDetail detail(Scenario s) {
    return new ScenarioDetail(s.getId(), s.getName(), s.getGraph(),
        ScenarioService.hashOf(s.getGraph()), s.getUpdatedAt());
  }

  @GetMapping
  public ResponseEntity<List<ScenarioRow>> list(Authentication auth) {
    return ResponseEntity.ok(scenarios.list(auth.getName()).stream().map(ScenarioController::row).toList());
  }

  @PostMapping
  public ResponseEntity<ScenarioDetail> create(Authentication auth, @Valid @RequestBody CreateScenarioRequest req) {
    return ResponseEntity.ok(detail(scenarios.create(auth.getName(), req.getName(), req.getGraph())));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ScenarioDetail> get(Authentication auth, @PathVariable UUID id) {
    return ResponseEntity.ok(detail(scenarios.get(auth.getName(), id)));
  }

  @PutMapping("/{id}")
  public ResponseEntity<ScenarioDetail> update(
      Authentication auth, @PathVariable UUID id, @Valid @RequestBody UpdateScenarioRequest req) {
    return ResponseEntity.ok(detail(scenarios.update(auth.getName(), id, req.getName(), req.getGraph())));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(Authentication auth, @PathVariable UUID id) {
    scenarios.delete(auth.getName(), id);
    return ResponseEntity.noContent().build();
  }
}
