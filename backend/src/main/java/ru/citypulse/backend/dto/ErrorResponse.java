package ru.citypulse.backend.dto;

import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Единый формат ошибок API: фронт показывает message как есть,
 * fieldErrors подсвечивает поля формы.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {
  private String message;
  private Map<String, String> fieldErrors;

  public ErrorResponse(String message) {
    this.message = message;
    this.fieldErrors = null;
  }
}
