package ru.citypulse.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.citypulse.backend.config.FlidaProps;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.dto.LoginRequest;
import ru.citypulse.backend.dto.RegisterRequest;
import ru.citypulse.backend.repository.UserRepository;
import ru.citypulse.backend.security.JwtService;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

  @Mock UserRepository users;
  @Mock PasswordEncoder encoder;
  @Mock JwtService jwt;
  @Mock FlidaProps flidaProps;

  private AuthService service;

  @BeforeEach
  void setup() {
    service = new AuthService(users, encoder, jwt, flidaProps);
  }

  @Test
  void registerDuplicateEmailThrows() {
    RegisterRequest req = new RegisterRequest();
    req.setEmail("a@b.c");
    req.setPassword("secret123");
    when(users.findByEmail("a@b.c")).thenReturn(Optional.of(User.builder().build()));
    assertThrows(IllegalArgumentException.class, () -> service.register(req));
    verify(users, never()).save(any());
  }

  @Test
  void loginWrongPasswordThrows() {
    LoginRequest req = new LoginRequest();
    req.setEmail("a@b.c");
    req.setPassword("wrong");
    User u = User.builder().email("a@b.c").passwordHash("hash").role("USER").build();
    when(users.findByEmail("a@b.c")).thenReturn(Optional.of(u));
    when(encoder.matches("wrong", "hash")).thenReturn(false);
    assertThrows(IllegalArgumentException.class, () -> service.login(req));
  }

  @Test
  void exchangeFlidaBlankTokenThrows() {
    assertThrows(IllegalArgumentException.class, () -> service.exchangeFlida("  "));
  }
}
