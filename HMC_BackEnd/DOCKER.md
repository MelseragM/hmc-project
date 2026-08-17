# Running HMC Sanaad B2E Backend with Docker

This guide explains how to build and run the NestJS backend in a container.

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

> **Base image note:** `node:20-slim` (Debian/glibc) is used on purpose — `node-oracledb` ships prebuilt glibc binaries, so no native compilation is needed. `oracledb` runs in **thin mode** (no Oracle Instant Client required).

---

## Quick start (Docker Compose)

Open **PowerShell** in the project folder:

```powershell
cd "C:\Users\melserag\OneDrive - Malomatia\hmc\development\HMC_BackEnd"
```

### 1. Create the `.env` file

`docker-compose.yml` loads runtime config from `.env`, but `.env` is git-ignored and is **not** committed, so you must create it once.

Do **not** just copy `.env.example` verbatim — it sets `ORACLE_DISABLED=false` with `ORACLE_DSN=localhost:1521`, which makes the container try to reach a database inside itself and crash-loop.

Use this minimal, clean-boot config (no database needed):

```powershell
@"
NODE_ENV=production
PORT=443
API_PREFIX=api/v1
CORS_ORIGINS=*
ORACLE_DISABLED=true
AUTH_DISABLED=true
JWT_SECRET=change_me_to_a_long_random_secret_value
LOG_LEVEL=debug
"@ | Set-Content -Encoding utf8 .env
```

### 2. Build and start

```powershell
docker compose up -d --build
```

The **first** build takes a few minutes (pulls `node:20-slim`, runs `npm ci`, downloads the `oracledb` binary). Later builds are cached and fast.

### 3. Verify it is running

```powershell
docker compose ps
docker compose logs -f api
```

Then open in a browser:

- **Health:** http://localhost:443/api/v1/health
- **Swagger UI:** http://localhost:443/docs
- **API base:** http://localhost:443/api/v1

A healthy response from `/api/v1/health` looks like:

```json
{ "status": "ok", "uptime": 5, "oracle": { "enabled": false, "reachable": false }, "timestamp": "..." }
```

---

## Configuration (`.env`)

All variables are validated at boot (see `src/core/config/env.validation.ts`). Missing values fall back to safe defaults.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `443` | Host + container port (kept in sync by compose). |
| `API_PREFIX` | `api/v1` | All routes are mounted under this prefix. |
| `CORS_ORIGINS` | `*` | Comma-separated allow-list, or `*`. |
| `ORACLE_DISABLED` | `true` (in this guide) | `true` boots without a DB pool. |
| `ORACLE_USER` / `ORACLE_PASSWORD` | empty | Oracle credentials. |
| `ORACLE_DSN` | empty | Easy Connect: `host:port/service`. |
| `ORACLE_POOL_MIN` / `ORACLE_POOL_MAX` | `2` / `10` | Connection pool sizing. |
| `AUTH_DISABLED` | `true` (in this guide) | `true` makes guards permissive for testing. |
| `JWT_SECRET` | — | Min 8 chars; set a long random value. |
| `LOG_LEVEL` | `debug` | `error` \| `warn` \| `log` \| `debug` \| `verbose`. |

After editing `.env`, apply changes with:

```powershell
docker compose up -d
```

---

## Connecting to an Oracle database

Edit `.env` and set:

```env
ORACLE_DISABLED=false
ORACLE_USER=xxhmc_snd
ORACLE_PASSWORD=your_password
ORACLE_DSN=host.docker.internal:1521/XEPDB1
```

- Use **`host.docker.internal`** (not `localhost`) to reach a database running on your Windows host — `localhost` inside the container refers to the container itself. `docker-compose.yml` already maps this host.
- For a DB on another server, use its hostname/IP: `ORACLE_DSN=dbhost:1521/SERVICE`.

Rebuild/restart, then confirm `oracle.reachable` is `true` at `/api/v1/health`.

---

## Authenticating against Azure Entra ID (instead of LDAPS)

The corporate-directory lookup used by the auth journey (API-2 user-validate and
API-5 login) can run against **Azure Entra ID via Microsoft Graph** instead of
LDAPS — no mobile-app changes, same OTP + MPIN flow. Select the provider with
`AUTH_DIRECTORY`:

```env
AUTH_DIRECTORY=entra
ENTRA_TENANT_ID=<tenant-guid>
ENTRA_CLIENT_ID=<app-registration-client-id>
ENTRA_CLIENT_SECRET=<client-secret>
```

- The Graph app registration needs the **`User.Read.All` (Application)**
  permission with **admin consent** — the backend uses app-only
  (client-credentials) auth to resolve the employee's identity + phone.
- `ENTRA_LOOKUP_ATTRIBUTE` (default `userPrincipalName`) controls how the
  mobile `username` is matched; the lookup tries `GET /users/{username}` first,
  then an OData `$filter` on this attribute (e.g. `mail`, `employeeId`).
- `AUTH_DIRECTORY=ldap` (the default) keeps the existing LDAPS path — flip back
  to it at any time as an instant rollback, no code redeploy.
- `ENTRA_CLIENT_SECRET` must come from the host/jumpstation environment, never a
  committed `.env`.

Restart after changing these (`docker compose up -d`), then confirm a login/
user-validate resolves the employee from Entra.

---

## Common commands

```powershell
docker compose logs -f api      # follow logs
docker compose ps               # container status + health
docker compose restart api      # restart (after .env changes)
docker compose up -d --build    # rebuild after code changes
docker compose down             # stop and remove the container
docker compose down -v          # also remove volumes
```

---

## Alternative: plain Docker (no `.env`)

The app falls back to safe defaults (empty Oracle credentials = pool skipped), so this boots cleanly with no env file:

```powershell
docker build -t hmc-sanaad-backend:latest .
docker run -d --name hmc-sanaad-backend -p 443:443 hmc-sanaad-backend:latest
```

Stop and remove it with:

```powershell
docker rm -f hmc-sanaad-backend
```

---

## Troubleshooting

**`env file .env not found`**
`docker-compose.yml` requires `.env`. Create it (see step 1) or use the plain-Docker command above.

**Container exits right after start with an Oracle error**
The DSN is unreachable from inside the container. Either set `ORACLE_DISABLED=true`, or point `ORACLE_DSN` at a reachable host (e.g. `host.docker.internal:1521/...`).

**`TypeError: Cannot set property outFormat ... which has only a getter`**
Fixed in `src/core/database/oracle.service.ts` (module imported as a mutable CommonJS object). If you see it, rebuild with `docker compose up -d --build`.

**Port already in use**
Change `PORT` in `.env` (compose maps `PORT` on both sides), then `docker compose up -d`.

**View health from the CLI**

```powershell
curl http://localhost:443/api/v1/health
```
