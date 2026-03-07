.PHONY: all up down clean fclean re logs ps windows check build-backend build-frontend

all: up

up:
	docker compose up --build -d

down:
	docker compose down

# clean: like down but also removes orphan containers from previous compose runs
clean:
	docker compose down --remove-orphans

fclean:
	docker compose down -v --rmi all --remove-orphans

re: fclean up

logs:
	docker compose logs -f

ps:
	docker compose ps

windows:
	docker compose up --build -d

check:
	bash tests/TranscendenceHealthCheck.sh | tee /dev/tty | sed 's/\x1b\[[0-9;]*m//g' > release.txt

build-backend:
	docker compose up --build -d backend

build-frontend:
	docker compose up --build -d frontend
