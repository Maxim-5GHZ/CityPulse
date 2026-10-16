package ru.citypulse.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.citypulse.backend.domain.Project;

public interface ProjectRepository extends JpaRepository<Project, UUID> {
  List<Project> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);

  Optional<Project> findByIdAndUserId(UUID id, UUID userId);
}
