package ru.citypulse.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.citypulse.backend.domain.Scenario;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.repository.ScenarioRepository;
import ru.citypulse.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class ScenarioServiceTest {

  @Mock ScenarioRepository scenarios;
  @Mock UserRepository users;

  private ScenarioService service;
  private User owner;

  private static final ObjectMapper JSON = new ObjectMapper();

  @BeforeEach
  void setup() {
    service = new ScenarioService(scenarios, users);
    owner = User.builder().email("a@b.c").role("USER").build();
    lenient().when(users.findByEmail("a@b.c")).thenReturn(Optional.of(owner));
    lenient().when(scenarios.save(any())).thenAnswer(i -> i.getArgument(0));
  }

  private static JsonNode graph() throws Exception {
    return JSON.readTree("{\"seed\":2040,\"nodes\":[{\"id\":\"n1\",\"x\":1}]}");
  }

  @Test
  void createTrimsName() throws Exception {
    Scenario s = service.create("a@b.c", "  Вариант А  ", graph());
    assertEquals("Вариант А", s.getName());
    assertEquals(owner.getId(), s.getOwnerId());
  }

  @Test
  void createBlankNameThrows() throws Exception {
    assertThrows(IllegalArgumentException.class, () -> service.create("a@b.c", "   ", graph()));
    verify(scenarios, never()).save(any());
  }

  @Test
  void createNullGraphThrows() {
    assertThrows(IllegalArgumentException.class, () -> service.create("a@b.c", "Вариант", null));
  }

  @Test
  void foreignProjectNotVisible() {
    UUID id = UUID.randomUUID();
    when(scenarios.findByIdAndOwnerId(id, owner.getId())).thenReturn(Optional.empty());
    assertThrows(NoSuchElementException.class, () -> service.get("a@b.c", id));
  }

  @Test
  void updateWithNothingThrows() throws Exception {
    Scenario s = Scenario.builder().ownerId(owner.getId()).name("A").graph(graph()).build();
    when(scenarios.findByIdAndOwnerId(s.getId(), owner.getId())).thenReturn(Optional.of(s));
    assertThrows(IllegalArgumentException.class,
        () -> service.update("a@b.c", s.getId(), null, null));
  }

  @Test
  void listOnlyMine() {
    service.list("a@b.c");
    verify(scenarios).findByOwnerIdOrderByUpdatedAtDesc(owner.getId());
  }

  @Test
  void hashStableToKeyOrder() throws Exception {
    JsonNode a = JSON.readTree("{\"x\":1,\"y\":{\"b\":2,\"a\":1}}");
    JsonNode b = JSON.readTree("{\"y\":{\"a\":1,\"b\":2},\"x\":1}");
    assertEquals(ScenarioService.hashOf(a), ScenarioService.hashOf(b));
    assertEquals(40, ScenarioService.hashOf(a).length());
  }

  @Test
  void unknownUserThrows() {
    when(users.findByEmail("ghost@x.ru")).thenReturn(Optional.empty());
    assertThrows(NoSuchElementException.class, () -> service.list("ghost@x.ru"));
    verify(scenarios, never()).findByOwnerIdOrderByUpdatedAtDesc(any());
  }
}
