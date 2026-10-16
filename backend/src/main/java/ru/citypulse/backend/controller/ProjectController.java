package ru.citypulse.backend.controller;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.citypulse.backend.domain.Project;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.dto.project.ProjectDetailResponse;
import ru.citypulse.backend.dto.project.ProjectSummaryResponse;
import ru.citypulse.backend.dto.project.SaveProjectRequest;
import ru.citypulse.backend.repository.ProjectRepository;
import ru.citypulse.backend.repository.UserRepository;

/**
 * CRUD сохранённых проектов конструктора. Все пути требуют JWT,
 * доступ строго к проектам текущего пользователя (sub = email).
 */
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {
  private final ProjectRepository projects;
  private final UserRepository users;

  private User currentUser(Authentication auth) {
    String email = auth.getName().toLowerCase().trim();
    return users.findByEmail(email)
        .orElseThrow(() -> new NoSuchElementException("Пользователь не найден"));
  }

  private static ProjectSummaryResponse summary(Project p) {
    return new ProjectSummaryResponse(
        p.getId(), p.getName(), p.getDescription(), p.getCreatedAt(), p.getUpdatedAt());
  }

  private static ProjectDetailResponse detail(Project p) {
    return new ProjectDetailResponse(
        p.getId(), p.getName(), p.getDescription(), p.getData(),
        p.getCreatedAt(), p.getUpdatedAt());
  }

  @GetMapping
  public ResponseEntity<List<ProjectSummaryResponse>> list(Authentication auth) {
    User user = currentUser(auth);
    List<ProjectSummaryResponse> rows = projects
        .findAllByUserIdOrderByUpdatedAtDesc(user.getId())
        .stream().map(ProjectController::summary).toList();
    return ResponseEntity.ok(rows);
  }

  @GetMapping("/{id}")
  public ResponseEntity<ProjectDetailResponse> getOne(Authentication auth, @PathVariable UUID id) {
    User user = currentUser(auth);
    Project p = projects.findByIdAndUserId(id, user.getId())
        .orElseThrow(() -> new NoSuchElementException("Проект не найден"));
    return ResponseEntity.ok(detail(p));
  }

  @PostMapping
  @Transactional
  public ResponseEntity<ProjectDetailResponse> create(
      Authentication auth, @Valid @RequestBody SaveProjectRequest req) {
    User user = currentUser(auth);
    Project p = Project.builder()
        .user(user)
        .name(req.getName().trim())
        .description(req.getDescription())
        .data(req.getData())
        .build();
    return ResponseEntity.status(HttpStatus.CREATED).body(detail(projects.save(p)));
  }

  @PutMapping("/{id}")
  @Transactional
  public ResponseEntity<ProjectDetailResponse> update(
      Authentication auth, @PathVariable UUID id, @Valid @RequestBody SaveProjectRequest req) {
    User user = currentUser(auth);
    Project p = projects.findByIdAndUserId(id, user.getId())
        .orElseThrow(() -> new NoSuchElementException("Проект не найден"));
    p.setName(req.getName().trim());
    p.setDescription(req.getDescription());
    p.setData(req.getData());
    return ResponseEntity.ok(detail(projects.save(p)));
  }

  @DeleteMapping("/{id}")
  @Transactional
  public ResponseEntity<Map<String, String>> delete(Authentication auth, @PathVariable UUID id) {
    User user = currentUser(auth);
    Project p = projects.findByIdAndUserId(id, user.getId())
        .orElseThrow(() -> new NoSuchElementException("Проект не найден"));
    projects.delete(p);
    return ResponseEntity.ok(Map.of("status", "deleted", "id", p.getId().toString()));
  }
}
