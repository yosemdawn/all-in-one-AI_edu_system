# yosem Backend

NestJS backend for authentication, classes, assignments, submissions, AI review, permissions, admin dashboard, and request logs.

## Requirements

- Node.js 22+
- MongoDB 7+
- Redis 7+ when AI review is enabled

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create local env:

```bash
copy .env.example .env
```

3. Start the backend:

```bash
npm run start:dev
```

## Quality Checks

```bash
npx eslint "{src,test,scripts}/**/*.ts"
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

## Production Env

Use `.env.production.example` as the starting point.

Required production values:

- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `REDIS_URL` when `AI_REVIEW_REQUIRED=true`
- `DOUBAO_API_KEY` when `AI_REVIEW_REQUIRED=true`

Important behavior:

- Production startup now fails fast if required secrets or AI queue dependencies are missing.
- AI review no longer silently downgrades in production when `AI_REVIEW_REQUIRED=true`.
- Public health endpoints are available at `/api/healthz` and `/api/readyz`.

## Docker Deployment

Build the image:

```bash
docker build -t yosem-backend:prod .
```

Run from the repository root using the canonical production configuration:

```bash
node backend/scripts/init-production-env.cjs
# Set CORS_ORIGINS in backend/.env.production before running Compose.
docker compose --env-file backend/.env.production up -d --build
```

The initialization script refuses to overwrite an existing configuration. Existing environments must follow the database/user and upload migration in [deployment notes](../docs/operational-hardening-2026-09-09.md), keeping their Compose project name and volumes. The compatibility compose file includes the root configuration (frontend, backend, authenticated MongoDB/Redis, persistent uploads).

## Security Defaults

- `helmet` is enabled
- global request throttling is enabled
- auth endpoints use stricter throttling
- CORS is allowlist-based in production
- `TRUST_PROXY=true` is rejected in production; use trusted proxy address ranges. Compose uses private-network proxies and Nginx overwrites incoming forwarding headers.

## Health Checks

- `GET /api/healthz`
- `GET /api/readyz`

Liveness remains lightweight. Readiness pings MongoDB and the configured Redis instance with short deadlines and returns HTTP 503 on dependency failure. Container health checks use readiness. Probes are exempt from application throttling.
