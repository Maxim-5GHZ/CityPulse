package ru.citypulse.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Флида ID в схеме Web SDK (public-клиент): PKCE/state/обмен кода живут во фронте,
 * секрета нет вообще. Бэкенд только проверяет Flida access_token через userinfo
 * сервер-сервер и минтит наш JWT.
 */
@Configuration
@ConfigurationProperties(prefix = "app.flida")
@Getter @Setter
public class FlidaProps {
  private String userinfoUri = "https://id.flida.ru/api/oidc/userinfo";
}
