-- Кейс 03 «Обнинск 2040»: проекты конструктора. Граф целиком в JSONB,
-- PostGIS не тянем (см. docs/system-analysis-case03.md §10.1).
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  graph JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scenarios_owner ON scenarios(owner_id);
