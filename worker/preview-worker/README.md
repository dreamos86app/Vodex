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
2. Dockerfile included, or Nixpacks `start.sh` / `npm run build && npm run start`
3. Set all env vars from `.env.example`
4. **Do not set `NODE_OPTIONS` on the Railway service** — heap is applied only to Vite child builds via `PREVIEW_NODE_MAX_OLD_SPACE_MB` (numeric, e.g. `4096`, never `$4096`).
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

## Railway memory (required for Vite builds)

Vite/React production builds run as child processes with `NODE_OPTIONS=--max-old-space-size=<MB>` only (default **4096** via `PREVIEW_NODE_MAX_OLD_SPACE_MB`). The **worker** process itself starts via `start.sh` with `NODE_OPTIONS` unset so Railway/Nixpacks cannot inject invalid flags. The worker exits at startup with `PREVIEW_WORKER_MEMORY_TOO_LOW` if container RAM is below heap + 512MB headroom.

| ZIP profile | Recommended Railway memory |
|-------------|----------------------------|
| Small static / few deps | **512MB–1GB** |
| Medium Base44 / Lovable exports | **1GB–2GB** |
| Large dependency-heavy ZIPs | **2GB–4GB** |

If builds fail with `VITE_BUILD_OOM` / “JavaScript heap out of memory”, upgrade Railway service memory or lower `PREVIEW_NODE_MAX_OLD_SPACE_MB` to fit the container. Trial/free tiers often need an upgrade for large exports.

## Safety

- Temp workspaces deleted after each job
- Preview installs use `NODE_ENV=development` and `NPM_CONFIG_PRODUCTION=false` so **devDependencies** (Vite, plugins) install
- `npm install` is preferred when package repair injects Vite; otherwise `npm ci` when lockfile exists
- `--ignore-scripts` unless `PREVIEW_ALLOW_NPM_SCRIPTS=1`
- Base44 exports may get automatic `vite` / `@vitejs/plugin-react` injection when missing from `package.json`
- Vite builds run `node_modules/.bin/vite build` with `NODE_ENV=production`, `NPM_CONFIG_PRODUCTION=false`, and configurable `NODE_OPTIONS` heap
- Vite config repair sets `build.sourcemap=false`, `minify: "esbuild"`, and a high `chunkSizeWarningLimit`
- Install/build timeouts enforced
- Secrets stripped from logs
- Next.js SSR apps are **not** faked — blocked with explicit `blockedReason`
