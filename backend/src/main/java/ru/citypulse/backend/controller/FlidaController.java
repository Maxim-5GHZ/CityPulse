package ru.citypulse.backend.controller;

import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
  private static final Logger log = LoggerFactory.getLogger(FlidaController.class);
  private final FlidaService flida;
  private final FlidaProps props;

  /** Старт входа: браузер уходит на страницу Флиды. */
  @GetMapping("/login")
  public ResponseEntity<Void> login() {
    log.info(
        "flida login: configured={} clientId={} redirectUri={} frontendUrl={}",
        flida.configured(),
        mask(props.getClientId()),
        props.getRedirectUri(),
        props.getFrontendUrl());
    try {
      String url = flida.buildLoginUrl();
      log.info("flida login: 302 to authorize, urlLen={}", url.length());
      return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    } catch (Exception e) {
      log.warn("flida login failed: {}", e.toString(), e);
      throw e;
    }
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
      @RequestParam(value = "error", required = false) String error,
      @RequestParam(value = "error_description", required = false) String errorDescription) {
    String base = props.getFrontendUrl().replaceAll("/+$", "");
    log.info(
        "flida callback: codePresent={} codeLen={} state={} error={} errorDescription={}",
        code != null,
        code == null ? 0 : code.length(),
        mask(state),
        error,
        errorDescription);
    try {
      if (error != null || code == null || state == null) {
        throw new IllegalArgumentException("Флида ID отклонил вход, error=" + error);
      }
      String token = flida.handleCallback(code, state);
      log.info("flida callback: ok, issued our JWT len={}", token.length());
      return found(base + "/flida/finish#token=" + token);
    } catch (Exception e) {
      log.warn(
          "flida callback failed: codePresent={} state={} error={} reason={}",
          code != null,
          mask(state),
          error,
          e.toString(),
          e);
      return found(base + "/login?flida=error");
    }
  }

  private static String mask(String v) {
    if (v == null || v.isBlank()) return "<empty>";
    return v.length() <= 6 ? "***" : v.substring(0, 6) + "***";
  }

  private static ResponseEntity<Void> found(String url) {
    return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
  }
}
