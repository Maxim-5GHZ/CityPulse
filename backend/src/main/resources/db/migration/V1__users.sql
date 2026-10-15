-- CityPulse V1: только пользователи. Свои таблицы — новыми миграциями V2__..., V3__...
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
