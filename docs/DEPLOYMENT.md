# DreamOS86 — Production deployment

Production at **https://dreamos86.com** only updates when **code is committed, pushed, and Vercel builds successfully**. Database schema is updated **separately** in Supabase — Vercel never runs migrations.

---

## A. Code deploy (Vercel)

### 1. Check local state

```bash
git status
git log origin/main..HEAD --oneline
```

- Uncommitted changes → not on GitHub yet.
- Unpushed commits → push before expecting production to change.

### 2. Commit and push

```bash
git add .
git commit -m "describe your change"
git push origin main
```

### 3. Wait for Vercel

1. Open [Vercel](https://vercel.com) → **DreamOS86** project → **Deployments**.
2. Wait until the latest `main` deployment shows **Ready** (green).
3. Confirm it is **Production · Current** (not only a Preview).
4. Open the deployment → **Build Logs** if status is **Error** (an old good deploy stays live until a build succeeds).

### 4. Verify the live site

- Hard refresh: `Ctrl+Shift+R` (Windows) or use an incognito window.
- Check commit message on the deployment matches your push.
- Spot-check routes: `/`, `/terms`, `/privacy`, `/auth/login`.

### Automatic deploys

If the repo is connected to Vercel with **Production branch = `main`**, every push to `main` triggers a production deploy automatically. No manual “Redeploy” is required unless you changed **environment variables** (redeploy after saving env vars).

### GitHub Actions (optional CI)

This repo can run `npm run build` on push via `.github/workflows/ci.yml`. That does **not** deploy to Vercel — it only catches build failures early. Vercel still performs the production build.

---

## B. Database deploy (Supabase)

**Vercel does not run Supabase migrations.**

Project ref: **`xycqutvqxtkbszytaxbe`**

### Option 1 — SQL Editor (dashboard)

1. Supabase → **SQL Editor**.
2. Run migrations from `supabase/migrations/` in **filename order** (oldest first).
3. Important bootstrap files if `profiles` is missing:
   - `20260519130000_ensure_public_profiles_bootstrap.sql`
   - `20260523183000_production_blockers_schema.sql`
4. Reload PostgREST schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

### Option 2 — Supabase CLI

```bash
supabase link --project-ref xycqutvqxtkbszytaxbe
supabase db push
```

Then in SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

### Auth URLs

Supabase → **Authentication** → **URL configuration**:

- Site URL: `https://dreamos86.com`
- Redirect URLs include: `https://dreamos86.com/auth/callback`

---

## C. Environment variables (Vercel Production)

Set in **Vercel → Project → Settings → Environment Variables → Production**:

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xycqutvqxtkbszytaxbe.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (or `SUPABASE_SECRET_KEY`) |
| `NEXT_PUBLIC_APP_URL` | **`https://dreamos86.com`** (not localhost) |
| `NEXT_PUBLIC_SITE_URL` | `https://dreamos86.com` |
| `OPENAI_API_KEY` | If using OpenAI |
| `ANTHROPIC_API_KEY` | If using Anthropic |
| `GOOGLE_GENERATIVE_AI_API_KEY` | If using Gemini (`GEMINI_API_KEY` also accepted) |

After changing any env var → **Redeploy** Production (Deployments → ⋯ → Redeploy).

---

## D. Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| Site UI unchanged after local edits | Not pushed / Vercel build failed | `git push`, check Vercel **Ready** + **Current** |
| `/terms` or `/privacy` 404 | Old deploy still live | Push legal pages commit; wait for Ready |
| Build Error on Vercel | TypeScript/build failure | Read build logs; fix locally with `npm run build` |
| Site loads but auth/profile 500 | Missing `profiles` table / stale schema | Run migrations + `NOTIFY pgrst, 'reload schema';` |
| “Sign in” while UI looks logged in | Stale client profile | Hard refresh; sign out/in; check session |
| AI Chat/Create 503 | No LLM keys on server | Add provider keys in Vercel; redeploy |
| OAuth redirect wrong | `NEXT_PUBLIC_APP_URL` or Supabase URLs | Fix env + Supabase redirect URLs |

### Vercel project settings checklist

- **Git** connected to correct repo
- **Production branch**: `main`
- **Root directory**: `.` (repo root — `package.json` at top level)
- **Build command**: `npm run build`
- **Install command**: `npm install`

### Owner admin: deployment status

Signed in as **dreamos86app@gmail.com** → **Admin** → **System** (auth health tab) includes a **Deployment status** panel (env names only, legal URL checks, migration reminders).

---

## E. Local development

```bash
npm run dev:fresh
```

Use **http://localhost:3000** only. Do not run `npm run clean` while `npm run dev` is running.

If Next warns about a parent `package-lock.json` on your Desktop, remove or move it — keep `dreamos-platform/package-lock.json`.

---

## Why dreamos86.com can stay stale

Local file changes do not affect production until they are **committed**, **pushed**, and **built by Vercel**. Supabase data/schema changes require a separate migration step.
