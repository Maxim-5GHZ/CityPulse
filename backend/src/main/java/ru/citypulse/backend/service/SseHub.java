package ru.citypulse.backend.service;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Хаб SSE-подписок: хранит эмиттеры, рассылает broadcast, heartbeat держит
 * соединения живыми. Заготовка под realtime (уведомления, live-лента).
 */
@Service
@Slf4j
public class SseHub {
  private final Map<String, SseEmitter> clients = new ConcurrentHashMap<>();

  public SseEmitter subscribe(String clientId) {
    SseEmitter emitter = new SseEmitter(0L);
    clients.put(clientId, emitter);
    emitter.onCompletion(() -> clients.remove(clientId));
    emitter.onTimeout(() -> clients.remove(clientId));
    emitter.onError(e -> clients.remove(clientId));
    try {
      emitter.send(SseEmitter.event().name("connected").data(Map.of("client", clientId)));
    } catch (IOException e) {
      clients.remove(clientId);
    }
    return emitter;
  }

  public int broadcast(String name, Object payload) {
    int sent = 0;
    for (Map.Entry<String, SseEmitter> entry : clients.entrySet()) {
      try {
        entry.getValue().send(SseEmitter.event().name(name).data(payload));
        sent++;
      } catch (IOException e) {
        clients.remove(entry.getKey());
      }
    }
    return sent;
  }

  public int clientCount() {
    return clients.size();
  }

  @Scheduled(fixedRate = 20000)
  void heartbeat() {
    broadcast("ping", Map.of("ts", System.currentTimeMillis()));
  }
}
