package ru.citypulse.backend.controller.admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class AdminUserControllerTest {

  @Mock UserRepository users;
  @Mock PasswordEncoder encoder;

  private AdminUserController controller;

  @BeforeEach
  void setup() {
    controller = new AdminUserController(users, encoder);
  }

  private static UsernamePasswordAuthenticationToken adminAuth() {
    return new UsernamePasswordAuthenticationToken("admin@x.ru", null,
        List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
  }

  @Test
  void listReturnsRows() {
    User u = User.builder().email("a@b.c").role("USER").build();
    when(users.findAll()).thenReturn(List.of(u));
    assertEquals(1, controller.list().getBody().size());
  }

  @Test
  void createDuplicateThrows() {
    AdminUserController.CreateUserRequest req = new AdminUserController.CreateUserRequest();
    req.setEmail("a@b.c");
    req.setPassword("secret123");
    when(users.findByEmail("a@b.c")).thenReturn(Optional.of(User.builder().build()));
    assertThrows(IllegalArgumentException.class, () -> controller.create(req));
    verify(users, never()).save(any());
  }

  @Test
  void cannotDemoteSelf() {
    UUID id = UUID.randomUUID();
    User me = User.builder().email("admin@x.ru").role("ADMIN").build();
    when(users.findById(id)).thenReturn(Optional.of(me));
    AdminUserController.RoleRequest req = new AdminUserController.RoleRequest();
    req.setRole("USER");
    assertThrows(IllegalArgumentException.class, () -> controller.setRole(adminAuth(), id, req));
  }

  @Test
  void cannotDeleteSelf() {
    UUID id = UUID.randomUUID();
    User me = User.builder().email("admin@x.ru").role("ADMIN").build();
    when(users.findById(id)).thenReturn(Optional.of(me));
    assertThrows(IllegalArgumentException.class, () -> controller.delete(adminAuth(), id));
  }
}
