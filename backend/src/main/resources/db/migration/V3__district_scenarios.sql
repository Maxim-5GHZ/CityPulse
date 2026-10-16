-- CityPulse V3: сценарии конструктора «Обнинск 2040».
-- Каждый сценарий — DistrictState целиком в JSONB, владелец — email из JWT.
-- Правило e2e: раз есть POST — обязан быть DELETE (см. ScenarioController).
CREATE TABLE IF NOT EXISTS district_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(320) NOT NULL,
  name VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_district_scenarios_owner ON district_scenarios (owner_email);
