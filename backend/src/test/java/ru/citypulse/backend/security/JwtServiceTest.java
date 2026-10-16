package ru.citypulse.backend.security;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class JwtServiceTest {

  private static final String SECRET = "test-secret-at-least-32-chars-long!!";

  @Test
  void generateAndParseRoundtrip() {
    JwtService jwt = new JwtService(SECRET, 60);
    String token = jwt.generate("user@example.com", "USER");
    assertEquals("user@example.com", jwt.parseEmail(token));
    assertEquals("USER", jwt.parseRole(token));
  }

  @Test
  void expiredTokenFailsParsing() {
    JwtService jwt = new JwtService(SECRET, -1);
    String token = jwt.generate("user@example.com", "USER");
    assertThrows(Exception.class, () -> jwt.parseEmail(token));
  }

  @Test
  void shortSecretIsPadded() {
    JwtService jwt = new JwtService("short", 60);
    String token = jwt.generate("a@b.c", "ADMIN");
    assertEquals("ADMIN", jwt.parseRole(token));
  }
}
