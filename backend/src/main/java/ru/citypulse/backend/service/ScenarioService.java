package ru.citypulse.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.citypulse.backend.domain.Scenario;
import ru.citypulse.backend.domain.User;
import ru.citypulse.backend.repository.ScenarioRepository;
import ru.citypulse.backend.repository.UserRepository;

/**
 * Кейс 03: проекты конструктора. Владелец — из JWT (там только email),
 * чужие проекты недоступны даже на чтение (запросы только по id + owner).
 */
@Service
@RequiredArgsConstructor
public class ScenarioService {
  private static final ObjectMapper JSON = new ObjectMapper();

  private final ScenarioRepository scenarios;
  private final UserRepository users;

  private User ownerOf(String email) {
    return users.findByEmail(email == null ? "" : email.toLowerCase().trim())
        .orElseThrow(() -> new NoSuchElementException("Пользователь не найден"));
  }

  @Transactional(readOnly = true)
  public List<Scenario> list(String email) {
    return scenarios.findByOwnerIdOrderByUpdatedAtDesc(ownerOf(email).getId());
  }

  @Transactional
  public Scenario create(String email, String name, JsonNode graph) {
    String clean = name == null ? "" : name.trim();
    if (clean.isEmpty()) {
      throw new IllegalArgumentException("Название проекта обязательно");
    }
    if (clean.length() > 120) {
      throw new IllegalArgumentException("Название проекта — до 120 символов");
    }
    if (graph == null || graph.isNull()) {
      throw new IllegalArgumentException("Нет графа проекта");
    }
    return scenarios.save(Scenario.builder()
        .ownerId(ownerOf(email).getId())
        .name(clean)
        .graph(graph)
        .build());
  }

  @Transactional(readOnly = true)
  public Scenario get(String email, UUID id) {
    return scenarios.findByIdAndOwnerId(id, ownerOf(email).getId())
        .orElseThrow(() -> new NoSuchElementException("Проект не найден"));
  }

  @Transactional
  public Scenario update(String email, UUID id, String name, JsonNode graph) {
    Scenario s = get(email, id);
    if (name != null) {
      String clean = name.trim();
      if (clean.isEmpty()) {
        throw new IllegalArgumentException("Название проекта обязательно");
      }
      if (clean.length() > 120) {
        throw new IllegalArgumentException("Название проекта — до 120 символов");
      }
      s.setName(clean);
    }
    if (graph != null && !graph.isNull()) {
      s.setGraph(graph);
    }
    if (name == null && (graph == null || graph.isNull())) {
      throw new IllegalArgumentException("Нечего обновлять: задайте name или graph");
    }
    return scenarios.save(s);
  }

  @Transactional
  public void delete(String email, UUID id) {
    scenarios.delete(get(email, id));
  }

  /**
   * sha1 канонического JSON графа: ключи объектов сортируем рекурсивно,
   * массивы не трогаем (порядок узлов/рёбер значим). Для воспроизводимости (§15).
   */
  public static String hashOf(JsonNode graph) {
    try {
      byte[] bytes = JSON.writeValueAsBytes(canonical(graph));
      MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
      byte[] digest = sha1.digest(bytes);
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        sb.append(String.format("%02x", b));
      }
      return sb.toString();
    } catch (Exception e) {
      throw new IllegalStateException("Не удалось посчитать hash проекта");
    }
  }

  private static JsonNode canonical(JsonNode node) {
    if (node.isObject()) {
      Map<String, JsonNode> sorted = new TreeMap<>();
      var it = node.fields();
      while (it.hasNext()) {
        var e = it.next();
        sorted.put(e.getKey(), e.getValue());
      }
      ObjectNode out = JSON.createObjectNode();
      sorted.forEach((k, v) -> out.set(k, canonical(v)));
      return out;
    }
    if (node.isArray()) {
      ArrayNode out = JSON.createArrayNode();
      node.forEach(v -> out.add(canonical(v)));
      return out;
    }
    return node;
  }

  /** Только для тестов: канонический JSON строкой. */
  static String canonicalJson(JsonNode node) {
    try {
      return new String(JSON.writeValueAsBytes(canonical(node)), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("Не удалось посчитать hash проекта");
    }
  }
}
