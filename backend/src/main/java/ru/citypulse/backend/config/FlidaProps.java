package ru.citypulse.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Настройки Флида ID: прилетают из env контейнера, значения — в application.yml. */
@Configuration
@ConfigurationProperties(prefix = "app.flida")
@Getter @Setter
public class FlidaProps {
  private String clientId = "";
  private String clientSecret = "";
  private String authorizeUri = "https://id.flida.ru/api/oidc/authorize";
  private String tokenUri = "https://id.flida.ru/api/oidc/token";
  private String userinfoUri = "https://id.flida.ru/api/oidc/userinfo";
  private String redirectUri = "http://localhost:3000/flida/oauth2/callback";
  private String frontendUrl = "http://localhost:3000";
}
