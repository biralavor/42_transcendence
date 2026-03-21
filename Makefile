.PHONY: all
all: up

.PHONY: up
up:
	docker build -f services/backend-base/Dockerfile -t backend-base .
	DOMAIN=$${DOMAIN:-$$(hostname -I 2>/dev/null | awk '{print $$1}')} ; \
	DOMAIN=$${DOMAIN:-localhost} ; \
	DOMAIN=$$DOMAIN docker compose up --build -d

.PHONY: down
down:
	docker compose down

# clean: like down but also removes orphan containers from previous compose runs
.PHONY: clean
clean:
	docker compose down --remove-orphans

.PHONY: fclean
fclean:
	docker compose down -v --rmi all --remove-orphans

.PHONY: re
re: fclean up

.PHONY: logs
logs:
	docker compose logs -f

.PHONY: ps
ps:
	docker compose ps

.PHONY: windows
windows:
	docker build -f services/backend-base/Dockerfile -t backend-base .
	DOMAIN=$$(hostname -I 2>/dev/null | awk '{print $$1}') docker compose up --build -d

.PHONY: wait
wait:
	@command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed. Install it and retry."; exit 1; }
	@echo "Waiting for all services to be ready (up to 60s)..."; \
	for i in $$(seq 30); do \
		user=$$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8443/api/users/health 2>/dev/null); \
		game=$$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8443/api/game/health 2>/dev/null); \
		chat=$$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8443/api/chat/health 2>/dev/null); \
		if [ "$$user" = "200" ] && [ "$$game" = "200" ] && [ "$$chat" = "200" ]; then \
			echo "All services ready."; exit 0; \
		fi; \
		printf "."; sleep 2; \
	done; \
	echo ""; echo "Timeout: services not ready after 60s."; exit 1

.PHONY: test
test:
	@echo "=== user-service tests ==="
	docker compose exec user-service sh -c \
		"pip install -q --root-user-action=ignore pytest==8.3.5 httpx==0.28.1 pytest-asyncio==0.24.0 && \
		 cd /app && pytest service/tests/ -v"
	@echo "=== game-service tests ==="
	docker compose exec game-service sh -c \
		"pip install -q --root-user-action=ignore pytest==8.3.5 httpx==0.28.1 pytest-asyncio==0.24.0 && \
		 cd /app && pytest service/tests/ -v"
	@echo "=== chat-service tests ==="
	docker compose exec chat-service sh -c \
		"pip install -q --root-user-action=ignore pytest==8.3.5 httpx==0.28.1 pytest-asyncio==0.23.8 asyncpg==0.30.0 && \
		 cd /app && pytest service/tests/test_service.py -v"

.PHONY: check
check: wait test
	bash tests/TranscendenceHealthCheck.sh | tee /dev/tty | sed 's/\x1b\[[0-9;]*m//g' > release.txt

# --- alembic migrations ---
# Usage: make migrate-user MSG=add_avatar_url_to_users
#        make migrate-game MSG=add_tournaments_table
#        make migrate-chat MSG=add_room_members
.PHONY: migrate-user
migrate-user:
	docker compose exec user-service sh -c "cd /app/service && alembic revision --autogenerate -m '$(MSG)'"

.PHONY: migrate-game
migrate-game:
	docker compose exec game-service sh -c "cd /app/service && alembic revision --autogenerate -m '$(MSG)'"

.PHONY: migrate-chat
migrate-chat:
	docker compose exec chat-service sh -c "cd /app/service && alembic revision --autogenerate -m '$(MSG)'"

.PHONY: migrate-upgrade
migrate-upgrade:
	docker compose exec user-service sh -c "cd /app/service && alembic upgrade head"
	docker compose exec game-service sh -c "cd /app/service && alembic upgrade head"
	docker compose exec chat-service sh -c "cd /app/service && alembic upgrade head"

# --- base image ---
.PHONY: build-base
build-base:
	docker build -f services/backend-base/Dockerfile -t backend-base .

# --- frontend ---
.PHONY: up-frontend
up-frontend:
	docker compose up --build -d frontend

.PHONY: down-frontend
down-frontend:
	docker compose stop frontend && docker compose rm -f frontend

.PHONY: re-front
re-front: down-frontend
	docker compose build --no-cache frontend
	docker compose up -d frontend

# --- all backend services ---
.PHONY: re-back
re-back: down-user down-game down-chat
	docker compose build --no-cache user-service game-service chat-service
	docker compose up -d user-service game-service chat-service

# --- user-service ---
.PHONY: up-user
up-user:
	docker compose up --build -d user-service

.PHONY: down-user
down-user:
	docker compose stop user-service && docker compose rm -f user-service

.PHONY: re-user
re-user: down-user
	docker compose build --no-cache user-service
	docker compose up -d user-service

# --- game-service ---
.PHONY: up-game
up-game:
	docker compose up --build -d game-service

.PHONY: down-game
down-game:
	docker compose stop game-service && docker compose rm -f game-service

.PHONY: re-game
re-game: down-game
	docker compose build --no-cache game-service
	docker compose up -d game-service

# --- database ---
.PHONY: show-tables
show-tables:
	docker compose exec db sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB -c "\dt"'

.PHONY: show-table-contents
show-table-contents:
	@docker compose exec db sh -c \
		'for tbl in $$(psql -U $$POSTGRES_USER -d $$POSTGRES_DB -At \
		-c "SELECT table_name FROM information_schema.tables \
		WHERE table_schema='"'"'public'"'"' \
		AND table_name NOT LIKE '"'"'alembic%'"'"' \
		ORDER BY table_name"); \
		do \
			echo ""; \
			echo "=== $$tbl ==="; \
			psql -U $$POSTGRES_USER -d $$POSTGRES_DB -c "SELECT * FROM $$tbl;"; \
		done'

.PHONY: show-tables-full
show-tables-full:
	docker compose exec db sh -c \
		'psql -U $$POSTGRES_USER -d $$POSTGRES_DB -c \
		"SELECT t.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default \
		FROM information_schema.tables t \
		JOIN information_schema.columns c ON t.table_name = c.table_name \
		WHERE t.table_schema = '"'"'public'"'"' \
		AND t.table_name NOT LIKE '"'"'alembic%'"'"' \
		ORDER BY t.table_name, c.ordinal_position;"'

# --- network access ---
.PHONY: show-ip
show-ip:
	@IP=$$(hostname -I 2>/dev/null | awk '{print $$1}'); \
	IP=$${IP:-localhost}; \
	echo ""; \
	echo "  Host LAN IP: $$IP"; \
	echo ""; \
	echo "  To access from another device on the same Wi-Fi:"; \
	echo "    1. Open https://$$IP:8443 in the browser"; \
	echo "    2. Accept the certificate warning (self-signed — tap Advanced → Accept the Risk)"; \
	echo "    3. 'make up' auto-detects your LAN IP and issues the TLS cert for it."; \
	echo "       If detection fails (macOS/Windows), DOMAIN defaults to 'localhost'."; \
	echo "       Override anytime: set DOMAIN=<ip> in .env and run 'make re-nginx'."; \
	echo ""

.PHONY: re-nginx
re-nginx:
	docker compose stop nginx && docker compose rm -f nginx
	docker compose up --build -d nginx

# --- chat-service ---
.PHONY: up-chat
up-chat:
	docker compose up --build -d chat-service

.PHONY: down-chat
down-chat:
	docker compose stop chat-service && docker compose rm -f chat-service

.PHONY: re-chat
re-chat: down-chat
	docker compose build --no-cache chat-service
	docker compose up -d chat-service
