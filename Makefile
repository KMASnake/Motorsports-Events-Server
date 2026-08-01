install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

docker-up:
	docker compose up --build

docker-down:
	docker compose down

docker-reset:
	docker compose down -v
