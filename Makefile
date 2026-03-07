.PHONY: all
all: up

.PHONY: up
up:
	docker compose up --build -d

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
	docker compose up --build -d

.PHONY: check
check:
	bash tests/TranscendenceHealthCheck.sh | tee /dev/tty | sed 's/\x1b\[[0-9;]*m//g' > release.txt

.PHONY: up-backend
up-backend:
	docker compose up --build -d backend

.PHONY: up-frontend
up-frontend:
	docker compose up --build -d frontend

.PHONY: down-backend
down-backend:
	docker compose stop backend && docker compose rm -f backend

.PHONY: down-frontend
down-frontend:
	docker compose stop frontend && docker compose rm -f frontend

.PHONY: re-backend
re-backend: down-backend
	docker compose build --no-cache backend
	docker compose up -d backend

.PHONY: re-frontend
re-frontend: down-frontend
	docker compose build --no-cache frontend
	docker compose up -d frontend
