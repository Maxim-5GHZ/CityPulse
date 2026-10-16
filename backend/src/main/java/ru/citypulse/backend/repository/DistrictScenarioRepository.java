package ru.citypulse.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.citypulse.backend.domain.DistrictScenario;

public interface DistrictScenarioRepository extends JpaRepository<DistrictScenario, UUID> {
  List<DistrictScenario> findAllByOwnerEmailOrderByUpdatedAtDesc(String ownerEmail);

  Optional<DistrictScenario> findByIdAndOwnerEmail(UUID id, String ownerEmail);
}
