-- Флида ID: привязка внешнего sub, пароль у таких юзеров отсутствует.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN flida_sub TEXT UNIQUE;
