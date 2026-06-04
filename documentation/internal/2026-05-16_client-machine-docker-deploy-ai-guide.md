# ISME Client Machine Docker Deploy Guide

Date: 2026-05-16

## Scope

This guide explains how to deploy the ISME v2 backend and frontend on the client machine using Docker Compose v2.

Client machine:

```text
Host/IP: 195.231.60.198
Deployment root: /opt/isme-v2
Compose file: /opt/isme-v2/compose.yaml
Frontend service: frontend
Backend service: backend
Frontend container: isme-v2-frontend
Backend container: isme-v2-backend
Public domains: ismeperditevapore.it, www.ismeperditevapore.it
Backup root: /root/isme-client-backups
```

Sensitive credentials are not included in this guide. Ask the operator for SSH credentials and read runtime secrets from the server-side `.env` files when needed.

## Safety Rules

- Do not delete, overwrite, restart, or reinstall anything unless the operator explicitly asks for it.
- Before risky changes, inspect the current state first.
- Do not create duplicate full backups for small code-only deploys unless requested.
- Keep backup and temporary artifacts under `/root/isme-client-backups`.
- Do not leave temporary SQL dumps, tarballs, or failed-attempt files in `/root` or `/tmp`.
- Use Docker Compose v2 syntax: `docker compose`, not `docker-compose`.
- Do not deploy the Electron/mobile app to this server.
- Never wipe or replace `backend/data/photo_before` and `backend/data/photo_after` during code deploys unless an explicit media migration/restore step is part of the runbook.

## Preflight Checks

Connect to the server and inspect the current stack:

```bash
cd /opt/isme-v2
docker compose ps
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
ls -la /opt/isme-v2
ls -la /opt/isme-v2/backend /opt/isme-v2/frontend
```

Expected runtime:

```text
isme-v2-backend: healthy
isme-v2-frontend: healthy
nginx is the public reverse proxy
Apache should not be serving the current v2 app
```

Check nginx before and after changes:

```bash
nginx -t
systemctl status nginx --no-pager
```

## Frontend-Only Deploy

Use this when only `ISME-fe-v2` changed.

Recommended local checks before syncing:

```bash
cd /path/to/ISME-fe-v2
npm run build
git status --short
```

Sync the changed frontend files to:

```text
/opt/isme-v2/frontend
```

For a small single-file patch, sync only that file. For a broader frontend release, sync the repository contents carefully, excluding local-only and Git metadata as appropriate.

Then rebuild and restart only the frontend service:

```bash
cd /opt/isme-v2
docker compose build frontend
docker compose up -d frontend
docker compose ps frontend
```

Wait until healthy:

```bash
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' isme-v2-frontend 2>/dev/null || true)
  echo "frontend health: $status"
  [ "$status" = "healthy" ] && break
  sleep 2
done
```

Smoke tests:

```bash
curl -k -sS -o /dev/null -w 'frontend_apex=%{http_code}\n' https://ismeperditevapore.it/
curl -k -sS -o /dev/null -w 'frontend_www=%{http_code}\n' https://www.ismeperditevapore.it/
curl -k -sS https://ismeperditevapore.it/health
```

Expected:

```text
frontend_apex=200
frontend_www=200
{"status":"ok", ...}
```

## Backend-Only Deploy

Use this when only `ISME-be-v2` changed.

Before replacing backend code, create a targeted code backup:

```bash
stamp=$(date -u +%Y-%m-%d_%H-%M-%S_UTC)
backup_dir="/root/isme-client-backups/${stamp}_backend-code-update"
mkdir -p "$backup_dir"
tar -czf "$backup_dir/opt_isme-v2_backend_before_update.tar.gz" -C /opt/isme-v2 backend
```

Sync backend code to:

```text
/opt/isme-v2/backend
```

Preserve the server-side runtime `.env`. Do not overwrite it with a local development `.env`.
Preserve backend media directories (`data/photo_before`, `data/photo_after`) and any persistent runtime data needed by file-serving endpoints.

If you are replacing backend files manually, do **not** run blanket deletion commands that remove `backend/data`.
Use a selective cleanup approach that keeps `.env*` and `data/`:

```bash
cd /opt/isme-v2/backend
find . -mindepth 1 -maxdepth 1 ! -name '.env*' ! -name 'data' -exec rm -rf {} +
```

Then rebuild and restart only the backend service:

```bash
cd /opt/isme-v2
docker compose build backend
docker compose up -d backend
docker compose ps backend
```

Wait until healthy:

```bash
for i in $(seq 1 45); do
  status=$(docker inspect -f '{{.State.Health.Status}}' isme-v2-backend 2>/dev/null || true)
  echo "backend health: $status"
  [ "$status" = "healthy" ] && break
  sleep 2
done
```

Smoke test:

```bash
curl -k -sS https://ismeperditevapore.it/health
```

Expected:

```text
{"status":"ok", ...}
```

## Full Backend + Frontend Deploy

Use this when both backend and frontend changed.

Recommended order:

```text
1. Inspect current containers and nginx.
2. Back up backend code if backend code is being replaced.
3. Sync backend code, preserving backend/.env.
3a. Preserve backend media directories (`backend/data/photo_before`, `backend/data/photo_after`).
4. Build and restart backend.
5. Wait for backend healthy and smoke /health.
6. Sync frontend code.
7. Build and restart frontend.
8. Wait for frontend healthy.
9. Run final public smoke tests.
```

Commands:

```bash
cd /opt/isme-v2
docker compose build backend
docker compose up -d backend
docker compose build frontend
docker compose up -d frontend
docker compose ps
```

Final smoke:

```bash
curl -k -sS https://ismeperditevapore.it/health
curl -k -sS -o /dev/null -w 'frontend_apex=%{http_code}\n' https://ismeperditevapore.it/
curl -k -sS -o /dev/null -w 'frontend_www=%{http_code}\n' https://www.ismeperditevapore.it/
docker compose ps
```

Expected:

```text
backend healthy
frontend healthy
/health returns status ok
frontend apex returns 200
frontend www returns 200
```

## Database Notes

The current v2 application database is:

```text
SteamLeaksV2
```

The backend runtime database credentials are stored on the server in:

```text
/opt/isme-v2/backend/.env
```

Read them from the server when needed:

```bash
cd /opt/isme-v2
grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER)=' backend/.env
```

Do not print or share database passwords in reports.

## Useful Verification Commands

Container state:

```bash
cd /opt/isme-v2
docker compose ps
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Nginx:

```bash
nginx -t
systemctl status nginx --no-pager
```

Public endpoints:

```bash
curl -k -sS https://ismeperditevapore.it/health
curl -k -sS -o /dev/null -w '%{http_code}\n' https://ismeperditevapore.it/
curl -k -sS -o /dev/null -w '%{http_code}\n' https://www.ismeperditevapore.it/
```

## Cleanup Expectations

After deploy:

- Keep intentional backups under `/root/isme-client-backups`.
- Remove failed-attempt artifacts only when they are clearly created by the deploy work and the operator approves deletion.
- Do not remove older backups unless explicitly requested.
- Do not leave temporary deploy archives in `/root` or `/tmp`.

## Reporting Back

A good final deployment report should include:

```text
What changed
Which service was deployed
Whether backend/database/frontend were touched
Build result
Container health
Public smoke test result
Backup path, if a backup was created
Any files intentionally left untouched
```
