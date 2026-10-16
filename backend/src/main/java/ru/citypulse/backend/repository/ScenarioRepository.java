package ru.citypulse.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.citypulse.backend.domain.Scenario;

public interface ScenarioRepository extends JpaRepository<Scenario, UUID> {
  /** Чужие проекты не светим: все запросы только по паре id + owner. */
  List<Scenario> findByOwnerIdOrderByUpdatedAtDesc(UUID ownerId);

  Optional<Scenario> findByIdAndOwnerId(UUID id, UUID ownerId);
}
