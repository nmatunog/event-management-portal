# Event Management Portal (Cloudflare-ready)

Modular full-stack setup:

- `frontend/`: React + Vite + Tailwind (UI)
- `backend/`: Cloudflare Worker (Hono API)

## Local Development

### Quick start (single command)

```bash
cd /path/to/Event-Management
npm install
npm run setup
npm run dev
```

This starts backend + frontend together.

### 1) Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional API base override:

```bash
# frontend/.env
VITE_API_BASE_URL=http://127.0.0.1:8787
```

### 2) Backend (Cloudflare Worker + D1)

```bash
cd backend
npm install
npm run d1:create
# copy generated database_id into backend/wrangler.toml
npm run d1:migrate:local
npm run dev
```

Worker runs locally via Wrangler.

## Deploy on Cloudflare Free Tier

## Backend API (Workers)

1. Login: `npx wrangler login`
2. Apply remote migrations + deploy:

```bash
cd backend
npm run d1:migrate:remote
npm run deploy
```

This deploys `backend/src/index.ts` based on `backend/wrangler.toml`.

## Frontend (Cloudflare Pages)

Create a new Cloudflare Pages project from your Git repo with:

- **Root directory**: `frontend`
- **Build command**: `npm run build`
- **Build output directory**: `dist`

If needed, set Pages environment variable:

- `VITE_API_BASE_URL=https://<your-worker-subdomain>.workers.dev`

## API Endpoints

- `GET /api/health`
- `GET|POST|PATCH|DELETE /api/events`
- `GET|POST /api/events/:eventId/registrations`
- `PATCH /api/registrations/:id/check-in`
- `POST /api/registrations/:id/installments/generate`
- `POST /api/registrations/:id/payments` (waterfall installment allocation)
- `GET /api/events/:eventId/financial-summary`
- `GET|POST /api/events/:eventId/sponsors`
- `GET|POST /api/events/:eventId/expenses`
- `GET|POST /api/events/:eventId/program-sessions`
- `GET|POST /api/events/:eventId/invitations`
- `PATCH /api/invitations/respond/:token`

Role guard for write endpoints is header-based for now:

- `x-role: admin` or `x-role: staff`

## Auth Migration (Supabase-ready)

Backend now supports Supabase JWT verification:

- Send `Authorization: Bearer <supabase_access_token>`
- Optional endpoint: `GET /api/auth/me`

Set these in `backend/wrangler.toml` (or Cloudflare env vars) when ready:

- `SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`
- `SUPABASE_ISSUER=https://<project-ref>.supabase.co/auth/v1`

Current local dev fallback remains enabled (`AUTH_DEV_FALLBACK=true`) so `x-role` still works while you transition.
