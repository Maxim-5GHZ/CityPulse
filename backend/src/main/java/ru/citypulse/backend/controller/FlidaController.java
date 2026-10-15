package ru.citypulse.backend.controller;

import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.citypulse.backend.config.FlidaProps;
import ru.citypulse.backend.service.FlidaService;

/** Вход через Флида ID: два редиректа, фронт в обмене не участвует. */
@RestController
@RequestMapping("/api/auth/flida")
@RequiredArgsConstructor
public class FlidaController {
  private final FlidaService flida;
  private final FlidaProps props;

  /** Старт входа: браузер уходит на страницу Флиды. */
  @GetMapping("/login")
  public ResponseEntity<Void> login() {
    return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(flida.buildLoginUrl())).build();
  }

  /**
   * Возврат от Флиды (?code&state — сюда же смотрит зарегистрированный redirect_uri через прокси).
   * Успех: 302 на фронт с НАШИМ JWT во фрагменте (#token= — фрагмент не уходит в сеть и не пишется в логи).
   * Ошибка: 302 обратно на /login с флагом.
   */
  @GetMapping("/callback")
  public ResponseEntity<Void> callback(
      @RequestParam(value = "code", required = false) String code,
      @RequestParam(value = "state", required = false) String state,
      @RequestParam(value = "error", required = false) String error) {
    String base = props.getFrontendUrl().replaceAll("/+$", "");
    try {
      if (error != null || code == null || state == null) {
        throw new IllegalArgumentException("Флида ID отклонил вход");
      }
      String token = flida.handleCallback(code, state);
      return found(base + "/flida/finish#token=" + token);
    } catch (Exception e) {
      return found(base + "/login?flida=error");
    }
  }

  private static ResponseEntity<Void> found(String url) {
    return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
  }
}
