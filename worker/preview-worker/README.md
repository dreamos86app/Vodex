# VODEX Preview Worker

Standalone Node service that builds imported ZIP app previews outside Vercel serverless.

## Prerequisites

1. Supabase project with migrations through `20260804120000_p31_dedicated_preview_worker.sql` applied.
2. Storage buckets (private):
   - `preview-artifacts` — built `index.html` + assets
   - `preview-sources` — `source.zip` per job
3. Environment variables (see `.env.example`).

## Local run

```bash
# From repo root
cp worker/preview-worker/.env.example worker/preview-worker/.env
# Fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

cd worker/preview-worker
npm install
npm run dev
```

From repo root:

```bash
npm run preview-worker:dev
```

## Vercel app behavior

- **Static HTML** — built inline on upload (no worker).
- **Vite / Next / Base44 / Lovable** — creates `preview_build_jobs` with `status=queued`, uploads `preview-sources/{projectId}/{jobId}/source.zip`.
- UI polls `/api/apps/[appId]/preview/status` until worker sets `preview_renderable`.

## Local inline builds (optional)

Set `PREVIEW_RUNTIME_BUILD=1` on the Next.js app to run npm builds in-process without the worker (dev only).

## Deploy (Railway / Render)

1. Build context: `worker/preview-worker`
2. Dockerfile included, or start command: `npm run build && npm run start`
3. Set all env vars from `.env.example`
4. Scale to 1 instance per worker ID (or unique `PREVIEW_WORKER_ID` per replica)

## Debug SQL (latest jobs)

`preview_build_jobs` uses **`locked_by`** (worker id), not `worker_id`:

```sql
select
  id,
  status,
  locked_by,
  blocked_reason,
  updated_at
from preview_build_jobs
order by updated_at desc
limit 10;
```

## Safety

- Temp workspaces deleted after each job
- Preview installs use `NODE_ENV=development` and `NPM_CONFIG_PRODUCTION=false` so **devDependencies** (Vite, plugins) install
- `npm install` is preferred when package repair injects Vite; otherwise `npm ci` when lockfile exists
- `--ignore-scripts` unless `PREVIEW_ALLOW_NPM_SCRIPTS=1`
- Base44 exports may get automatic `vite` / `@vitejs/plugin-react` injection when missing from `package.json`
- Install/build timeouts enforced
- Secrets stripped from logs
- Next.js SSR apps are **not** faked — blocked with explicit `blockedReason`
