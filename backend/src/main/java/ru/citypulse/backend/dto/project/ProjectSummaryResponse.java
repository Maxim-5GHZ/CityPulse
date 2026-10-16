package ru.citypulse.backend.dto.project;

import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectSummaryResponse {
  private UUID id;
  private String name;
  private String description;
  private OffsetDateTime createdAt;
  private OffsetDateTime updatedAt;
}
