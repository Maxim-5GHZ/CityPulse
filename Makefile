.PHONY: dev prod down down-prod logs logs-prod clean certs

# DEV: без SSL, с hot reload (Java + JS). Ctrl+C чтобы остановить.
dev:
	docker compose up --build

# PROD: с SSL через nginx. Серты сгенерируются сами при первом запуске.
prod: certs
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
	@echo "== CityPulse PROD поднят: https://localhost:$${HTTPS_PORT:-443} (согласись на самоподписанный серт) =="

down:
	docker compose down

down-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

logs:
	docker compose logs -f

logs-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Полный снос: контейнеры + volumes (БД ПОТРЕТСЯ) + образы скелета
clean:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v --rmi local
	rm -rf frontend/.next backend/target

# Самоподписанный серт для prod (825 дней). В репо не коммитится (см. .gitignore).
certs:
	./nginx/gen-certs.sh
