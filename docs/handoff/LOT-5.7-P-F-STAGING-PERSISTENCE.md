# 5.7-P-F — Staging infrastructure persistence

Date: 2026-08-25  
Status: **IMPLEMENTED — VPS REVALIDATION REQUIRED**

## Gap and architecture

The validated preproduction runtime depended on a manually created Prometheus
container and `docker network connect` for the historical Caddy container.
Neither operation survived a deterministic rebuild from version control.

The smallest safe architecture keeps Caddy owned by the historical Production
stack and adds no competing listener on ports 80/443:

- the preproduction Compose project owns a stable named network
  `mse-preprod-proxy` and gives API/Web collision-free aliases
  `mse-preprod-api` and `mse-preprod-web`;
- a versioned Compose override attaches the existing `caddy` service to that
  network during a normal Compose recreate;
- an integration Caddyfile imports the unchanged historical Production
  Caddyfile, then the versioned preproduction vhost;
- preproduction Prometheus is a permanent service on the private default
  network, with no published port and a named TSDB volume.

The root `Caddyfile` remains unchanged. Its Production host and `api:8000`
upstream therefore retain their historical semantics. Existing Caddy data and
config volumes continue to own ACME certificates.

## Versioned configuration

- `docker-compose.preprod.yml`: Prometheus, TSDB volume and shared proxy
  network/aliases;
- `infra/caddy/Caddyfile.preprod`: preproduction HTTPS routing and public
  hardening;
- `infra/caddy/Caddyfile.integration`: Production + preproduction imports;
- `infra/caddy/docker-compose.preprod-network.yml`: additive override for the
  historical `caddy` service.

Prometheus reuses `monitoring/prometheus.yml` and
`monitoring/alert-rules.yml`. It scrapes `api:3001/metrics`, retains staging
data for 15 days, restarts unless stopped and persists in
`mse_preprod_prometheus_data`. It has no `ports` entry.

## Deployment protocol

Run from the preproduction checkout at the audited SHA. Do not use `down` for
a routine recreate; `up --force-recreate` preserves named volumes and the
shared network.

```sh
export MSE_PREPROD_REPO=/home/debian/motorsports-events-server-preprod
export MSE_PRODUCTION_CADDYFILE=/absolute/path/to/historical/Caddyfile
export PRODUCTION_COMPOSE_FILE=/absolute/path/to/historical/docker-compose.yml
export PRODUCTION_ENV_FILE=/absolute/path/to/historical/.env

cd "$MSE_PREPROD_REPO"
git status --short
git rev-parse HEAD

docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml config --quiet
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml \
  up -d --build --wait postgres
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml run --rm migrate
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml exec -T postgres \
  psql -U mse -d motorsports_events -Atc \
  "select count(*) from provider_instances where enabled or state='active'" \
  | grep -qx 0
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml \
  up -d --wait api worker web prometheus

docker compose --env-file "$PRODUCTION_ENV_FILE" \
  -f "$PRODUCTION_COMPOSE_FILE" \
  -f "$MSE_PREPROD_REPO/infra/caddy/docker-compose.preprod-network.yml" \
  config --quiet
docker compose --env-file "$PRODUCTION_ENV_FILE" \
  -f "$PRODUCTION_COMPOSE_FILE" \
  -f "$MSE_PREPROD_REPO/infra/caddy/docker-compose.preprod-network.yml" \
  run --rm --no-deps caddy caddy validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose --env-file "$PRODUCTION_ENV_FILE" \
  -f "$PRODUCTION_COMPOSE_FILE" \
  -f "$MSE_PREPROD_REPO/infra/caddy/docker-compose.preprod-network.yml" \
  up -d --no-deps caddy
```

The stable network is created by the preproduction Compose project before the
Caddy override is applied. No `docker network connect` and no manual
`docker run` are part of this protocol. The zero-active-provider SQL gate is
mandatory before starting/recreating the worker; stop if it is non-zero.

## Mandatory VPS recreate proof

Record the expected SHA, clean worktree and `/health/live` release metadata.
Repeat the zero-active-provider SQL gate above, then execute:

```sh
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml \
  up -d --force-recreate --wait api worker web prometheus
```

Without any manual network operation, prove:

```sh
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml ps
docker inspect --format '{{.RestartCount}} {{.State.OOMKilled}}' mse-preprod-worker-1
curl -fsS http://127.0.0.1:3101/health
curl -fsS http://127.0.0.1:3101/health/live
curl -fsS http://127.0.0.1:3101/health/ready

docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml exec -T prometheus \
  wget -qO- 'http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22motorsports-events-api%22%7D'
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml exec -T prometheus \
  wget -qO- 'http://127.0.0.1:9090/api/v1/query?query=motorsports_postgres_ready'
docker compose --env-file .env.preprod \
  -f docker-compose.yml -f docker-compose.preprod.yml exec -T prometheus \
  wget -qO- http://127.0.0.1:9090/api/v1/rules
docker inspect mse-preprod-prometheus-1 --format '{{range .Mounts}}{{.Name}} {{.Destination}}{{println}}{{end}}'

curl --fail --silent --show-error https://preprod.motorsports-events.fr/ >/dev/null
curl --fail --silent --show-error https://preprod.motorsports-events.fr/health >/dev/null
curl -sS -o /dev/null -w '%{http_code}\n' https://preprod.motorsports-events.fr/metrics
for path in /.env /.git/config /server-status /actuator/env /wp-admin; do
  curl -sS -o /dev/null -w "$path %{http_code}\n" "https://preprod.motorsports-events.fr$path"
done
curl -sS -o /dev/null -w '%{http_code}\n' https://preprod.motorsports-events.fr/events

curl -sSI -H 'Origin: https://preprod.motorsports-events.fr' \
  https://preprod.motorsports-events.fr/health
curl -sSI -H 'Origin: https://evil.example' \
  https://preprod.motorsports-events.fr/health
curl --fail --silent --show-error https://motorsports-events.fr/ >/dev/null
```

Expected: all five preproduction services plus Caddy running; worker
`RestartCount=0`, `OOMKilled=false`; three health endpoints 200; Prometheus
target UP, PostgreSQL gauge 1 and three alert rules loaded; named TSDB mount;
TLS verification 0; public sensitive probes including `/metrics` return 404;
SPA route 200; preproduction CORS echoed only for the approved origin; the
Production host remains healthy.

Finally verify `PREVIEW_API_ENABLED=false` inside the API container and record
`PROVIDER_CALLS=0` / `PROVIDER_CREDITS=0`. No provider credential or call is
needed for this protocol.

## Rollback

1. Keep the PostgreSQL and Prometheus named volumes; do not run migration DOWN.
2. Recreate the historical Caddy service from its original Compose files only:

```sh
docker compose --env-file "$PRODUCTION_ENV_FILE" \
  -f "$PRODUCTION_COMPOSE_FILE" up -d --force-recreate --no-deps caddy
```

3. Revert the staging configuration commit and recreate the preproduction
   services from the previous release.
4. Confirm `https://motorsports-events.fr` first, then the preproduction
   loopback health endpoints. The preproduction public hostname may be
   unavailable after rollback; Production must remain unaffected.

Production Preview remains OFF. This infrastructure work authorizes no real
provider call, external client onboarding, full Lot 5.7, 5.8+ or merge main.
