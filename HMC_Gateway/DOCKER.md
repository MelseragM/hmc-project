# Running HMC Sanaad Gateway with Docker

This guide explains how to build and run the NestJS gateway in a container. It
mirrors the HMC_BackEnd Docker setup, minus the Oracle Instant Client (the
gateway has no database dependency).

## Prerequisites

- **Docker Desktop** running (Windows/macOS) or Docker Engine + Compose plugin (Linux).
- Verify your install:

```powershell
docker --version
docker compose version
```

## Files in this repo

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: compiles TypeScript, then produces a lean `node:20-slim` runtime image running as the non-root `node` user. |
| `docker-compose.yml` | Builds the image, maps the port, loads `.env`, adds a healthcheck, and maps `host.docker.internal`. |
| `.dockerignore` | Keeps `node_modules`, `dist`, `.env`, etc. out of the build context. |

> **Base image note:** `node:20-slim` (Debian/glibc) matches the backend image.
> Unlike the backend, the gateway has **no native dependencies** — no
> `node-oracledb`, no Oracle Instant Client — so the runtime stage is just the
> compiled `dist/` plus production `node_modules`.

---

## Quick start (Docker Compose)

Open **PowerShell** in the project folder:

```powershell
cd "C:\projects\hmc\development\HMC_Gateway"
```

### 1. Create the `.env` file

`docker-compose.yml` loads runtime config from `.env`, which is git-ignored and
**not** committed, so you must create it once.

The gateway's `JWT_SECRET` / `JWT_ISSUER` / `JWT_AUDIENCE` **must match
HMC_BackEnd's**, so tokens the backend issues at login verify locally at the
gateway. `BACKEND_BASE_URL` must point at the running backend.

Minimal config for local testing (backend running on the Docker host, auth off):

```powershell
@"
NODE_ENV=production
GATEWAY_PORT=443
API_PREFIX=api/v1
CORS_ORIGINS=*
BACKEND_BASE_URL=http://host.docker.internal:3009
BACKEND_API_PREFIX=api/v1
JWT_SECRET=change_me_to_a_long_random_secret_value
AUTH_DISABLED=true
LOG_LEVEL=debug
"@ | Set-Content -Encoding utf8 .env
```

> For a real deployment set `AUTH_DISABLED=false` and use the **same**
> `JWT_SECRET` as the backend.

### 2. Build and start

```powershell
docker compose up -d --build
```

The **first** build takes a couple of minutes (pulls `node:20-slim`, runs
`npm ci`). Later builds are cached and fast.

### 3. Verify it is running

```powershell
docker compose ps
docker compose logs -f gateway
```

Then open in a browser:

- **Gateway liveness:** http://localhost:443/api/v1/health
- **Backend connectivity:** http://localhost:443/api/v1/health/backend
- **Swagger UI:** http://localhost:443/docs

A healthy response from `/api/v1/health` looks like:

```json
{ "status": "ok", "uptime": 5, "timestamp": "..." }
```

---

## Configuration (`.env`)

All variables are validated at boot (see `src/core/config/env.validation.ts`).
Missing values fall back to safe defaults, so the gateway boots even with an
empty `.env` — except `JWT_SECRET`, which compose requires you to set.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `GATEWAY_PORT` | `443` | Host + container port (kept in sync by compose). |
| `API_PREFIX` | `api/v1` | All routes are mounted under this prefix. |
| `CORS_ORIGINS` | `*` | Comma-separated allow-list, or `*`. |
| `BACKEND_BASE_URL` | `http://localhost:3009` | Upstream HMC_BackEnd base URL. Use `host.docker.internal` from a container. |
| `BACKEND_API_PREFIX` | `api/v1` | Backend's route prefix. |
| `BACKEND_TIMEOUT_MS` | `30000` | Proxy request timeout. |
| `JWT_SECRET` | — | **Required.** Min 8 chars; must match HMC_BackEnd. |
| `JWT_ISSUER` | `sanaad` | Must match HMC_BackEnd. |
| `JWT_AUDIENCE` | `sanaad-b2e` | Must match HMC_BackEnd. |
| `AUTH_DISABLED` | `false` | `true` makes guards permissive for testing. |
| `LOG_LEVEL` | `debug` | `error` \| `warn` \| `log` \| `debug` \| `verbose`. |

After editing `.env`, apply changes with:

```powershell
docker compose up -d
```

---

## Common commands

```powershell
docker compose logs -f gateway   # follow logs
docker compose ps                # container status + health
docker compose restart gateway   # restart (after .env changes)
docker compose up -d --build     # rebuild after code changes
docker compose down              # stop and remove the container
```

---

## Alternative: plain Docker

`JWT_SECRET` has a dev default in the app, so this boots without an env file
(use only for local smoke tests):

```powershell
docker build -t hmc-gateway:latest .
docker run -d --name hmc-gateway -p 443:443 `
  -e BACKEND_BASE_URL=http://host.docker.internal:3009 `
  -e AUTH_DISABLED=true `
  --add-host host.docker.internal:host-gateway `
  hmc-gateway:latest
```

Stop and remove it with:

```powershell
docker rm -f hmc-gateway
```

---

## Troubleshooting

**`env file .env not found`**
`docker-compose.yml` requires `.env`. Create it (see step 1) or use the
plain-Docker command above.

**`set JWT_SECRET ... in the environment`**
Compose fails fast if `JWT_SECRET` is unset in both the shell env and `.env`.
Set it — and make it identical to HMC_BackEnd's.

**`/health/backend` returns `"status":"error"`**
The gateway can't reach the backend. Check `BACKEND_BASE_URL` — from inside a
container, a backend on the host is `http://host.docker.internal:<port>`, not
`localhost`.

**401 on proxied routes**
The bearer token failed local verification. Ensure `JWT_SECRET`, `JWT_ISSUER`
and `JWT_AUDIENCE` match the backend that issued the token, or set
`AUTH_DISABLED=true` for testing.

**Port already in use**
Change `GATEWAY_PORT` in `.env` (compose maps it on both sides), then
`docker compose up -d`.

**View health from the CLI**

```powershell
curl http://localhost:443/api/v1/health
```
