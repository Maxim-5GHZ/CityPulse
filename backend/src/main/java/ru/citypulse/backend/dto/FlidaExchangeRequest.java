package ru.citypulse.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/** Flida access_token, добытый Web SDK во фронте — бэкенд перепроверит его через userinfo. */
@Getter @Setter
public class FlidaExchangeRequest {
  @NotBlank(message = "Нет токена Флида ID")
  @JsonProperty("access_token")
  private String accessToken;
}
