package ru.citypulse.backend.dto.project;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SaveProjectRequest {
  @NotBlank(message = "Название проекта обязательно")
  private String name;

  private String description;

  @NotBlank(message = "Данные проекта не могут быть пустыми")
  private String data;
}
