package ru.citypulse.backend.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Кейс 03: сохранённый вариант конструктора. Граф — JSONB целиком, считает фронт (turf). */
@Entity
@Table(name = "scenarios")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Scenario {
  @Id
  @Column(columnDefinition = "uuid")
  @Builder.Default
  private UUID id = UUID.randomUUID();

  @Column(name = "owner_id", nullable = false, columnDefinition = "uuid")
  private UUID ownerId;

  @Column(nullable = false, length = 120)
  private String name;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private JsonNode graph;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (createdAt == null) createdAt = OffsetDateTime.now();
    if (updatedAt == null) updatedAt = createdAt;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = OffsetDateTime.now();
  }
}
