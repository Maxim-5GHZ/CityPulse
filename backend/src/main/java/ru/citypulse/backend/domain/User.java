package ru.citypulse.backend.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
  @Id
  @Column(columnDefinition = "uuid")
  @Builder.Default
  private UUID id = UUID.randomUUID();

  @Column(nullable = false, unique = true, length = 320)
  private String email;

  @Column(name = "password_hash")
  private String passwordHash;

  /** Внешний sub из Флида ID (у таких юзеров пароля нет). */
  @Column(name = "flida_sub", unique = true)
  private String flidaSub;

  @Column(nullable = false, length = 16)
  @Builder.Default
  private String role = "USER";

  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (createdAt == null) createdAt = OffsetDateTime.now();
  }
}
