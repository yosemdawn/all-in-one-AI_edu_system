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

Run with Docker Compose:

```bash
copy .env.production.example .env.production
docker compose -f compose.prod.yml up -d --build
```

The compose file starts:

- `backend`
- `mongo`
- `redis`

## Security Defaults

- `helmet` is enabled
- global request throttling is enabled
- auth endpoints use stricter throttling
- CORS is allowlist-based in production
- `trust proxy` can be enabled via `TRUST_PROXY=true`

## Health Checks

- `GET /api/healthz`
- `GET /api/readyz`

Both return a standard envelope with `data.ok === true` when the app is up.
