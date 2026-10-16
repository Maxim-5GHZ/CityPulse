package ru.citypulse.backend.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.*;

/**
 * Сценарий конструктора «Обнинск 2040»: DistrictState целиком в JSONB.
 * Владелец — email из JWT, чужие сценарии недоступны.
 */
@Entity
@Table(name = "district_scenarios")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DistrictScenario {
  @Id
  @Column(columnDefinition = "uuid")
  @Builder.Default
  private UUID id = UUID.randomUUID();

  @Column(name = "owner_email", nullable = false, length = 320)
  private String ownerEmail;

  @Column(nullable = false, length = 120)
  private String name;

  /** DistrictState как JSON-строка (колонка JSONB). */
  @Column(nullable = false, columnDefinition = "jsonb")
  private String payload;

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (createdAt == null) createdAt = OffsetDateTime.now();
    if (updatedAt == null) updatedAt = OffsetDateTime.now();
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = OffsetDateTime.now();
  }
}
