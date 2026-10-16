package ru.citypulse.backend.controller;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Method;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import ru.citypulse.backend.dto.ErrorResponse;

/** Единый формат ошибок: статусы и русские сообщения, без web-контекста и БД. */
class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void badRequestKeepsMessage() {
    ResponseEntity<ErrorResponse> res = handler.badRequest(new IllegalArgumentException("Плохо"));
    assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
    assertEquals("Плохо", res.getBody().getMessage());
  }

  @Test
  void validationReturnsFirstErrorAndFieldMap() throws Exception {
    Method m = Dummy.class.getMethod("dummy", String.class);
    BeanPropertyBindingResult br = new BeanPropertyBindingResult(new Object(), "req");
    br.addError(new FieldError("req", "email", "должна быть почтой"));
    MethodArgumentNotValidException ex = new MethodArgumentNotValidException(new MethodParameter(m, 0), br);

    ResponseEntity<ErrorResponse> res = handler.validation(ex);
    assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
    assertNotNull(res.getBody().getFieldErrors());
    assertEquals("должна быть почтой", res.getBody().getFieldErrors().get("email"));
  }

  @Test
  void notFoundUsesMessageOrDefault() {
    assertEquals(HttpStatus.NOT_FOUND, handler.notFound(new NoSuchElementException("Нет юзера")).getStatusCode());
    assertEquals("Не найдено", handler.notFound(new NoSuchElementException()).getBody().getMessage());
  }

  @Test
  void forbiddenIs403() {
    ResponseEntity<ErrorResponse> res = handler.forbidden(new AccessDeniedException("x"));
    assertEquals(HttpStatus.FORBIDDEN, res.getStatusCode());
    assertEquals("Недостаточно прав", res.getBody().getMessage());
  }

  @Test
  void conflictIs409() {
    assertEquals(HttpStatus.CONFLICT,
        handler.conflict(new DataIntegrityViolationException("dup")).getStatusCode());
  }

  @Test
  void unexpectedHidesInternals() {
    ResponseEntity<ErrorResponse> res = handler.unexpected(new RuntimeException("secret-stack"));
    assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, res.getStatusCode());
    assertFalse(res.getBody().getMessage().contains("secret-stack"));
  }

  static class Dummy {
    public void dummy(String ignored) {
    }
  }
}
