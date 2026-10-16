package ru.citypulse.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CityPulseApplication {
  public static void main(String[] args) {
    SpringApplication.run(CityPulseApplication.class, args);
  }
}
