# Live E2E authentication (DreamOS86)

**Structure-only** checks print:

> **STRUCTURE-ONLY PASS — NOT LIVE PROOF**

User-flow competitive scores stay **capped at 85** until `.dreamos-evidence.json` has `e2eLiveProof: true` from a live run.

---

## One-command live proof (auth + E2E + benchmark)

```bash
npm run prove:live
```

Runs: `verify:e2e-auth` → `@live` E2E → `benchmark:smoke` (live) → `benchmark:score` → `verify:competitive-score`.

Writes: `.dreamos-evidence.json`, `.dreamos-benchmark-results.json`, `benchmarks/reports/benchmark-report.md`.

## One-command live E2E (after auth exists)

```bash
npm run test:e2e:live:ready
```

This checks dev server + auth, runs `@live` tests, writes `.dreamos-evidence.json`, and prints **LIVE E2E PASSED** or **LIVE E2E FAILED**.

---

## First-time setup (Cursor terminal)

### 1. Start dev server (terminal 1)

```bash
npm run dev
```

`npm run dev` sets `NODE_USE_SYSTEM_CA=1` on Windows so Supabase TLS works (fixes `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and login/session failures).

Wait until `http://localhost:3000` loads.

### 2. Generate auth (terminal 2)

**Interactive (browser):**

```bash
npm run setup:e2e-auth
```

**Headless (CI / no browser) — add to `.env.local` (never commit):**

```
E2E_TEST_EMAIL=your-test-account@example.com
E2E_TEST_PASSWORD=your-test-password
```

```bash
npm run setup:e2e-auth:headless
```

If the dev server is not running, setup prints:

```bash
npm run dev
```

If auth is missing, it opens (or prints):

```bash
npx playwright codegen http://localhost:3000/create --save-storage=.playwright-auth.json
```

Steps in the browser:
1. Sign in
2. Go to `/create`
3. Close codegen

**Auth file:** repo root `.playwright-auth.json` (must be gitignored — setup verifies this)

### 3. Verify auth

```bash
npm run verify:e2e-auth
```

Checks: file exists, non-empty, gitignored, session valid (no secrets printed).

### 4. Run live E2E

```bash
npm run test:e2e:live:ready
```

---

## verify:e2e outcomes

| Output | Meaning |
|--------|---------|
| `STRUCTURE-ONLY PASS — NOT LIVE PROOF` | Spec files exist only |
| `LIVE E2E PASSED` | Live proof recorded |
| `LIVE E2E FAILED` | Live run failed |
| `LIVE E2E BLOCKED — .playwright-auth.json missing` | Need setup |

---

## TLS for Supabase + local login (Windows)

If login, OAuth callback, or verify scripts fail with:

```
fetch failed
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

Diagnose:

```powershell
npm run verify:tls
```

Safe fix (Cursor terminal, PowerShell):

```powershell
$env:NODE_USE_SYSTEM_CA="1"
npm run verify:tls
npm run dev
```

`npm run dev` already sets `NODE_USE_SYSTEM_CA=1` via `cross-env`.

**Do NOT** use `NODE_TLS_REJECT_UNAUTHORIZED=0` in scripts, `.env`, or Windows environment variables.

If `verify:tls` warns that `NODE_TLS_REJECT_UNAUTHORIZED=0` is set, remove it from **System Properties → Environment Variables** (User and System).

---

## Reset expired auth

```powershell
del .playwright-auth.json
npm run setup:e2e-auth
```

---

## Security

- Never commit `.playwright-auth.json`
- Scripts never print cookie values or secrets

---

## Evidence

Live runs write **`.dreamos-evidence.json`** — the competitive scoreboard reads `e2eLiveProof` from this file.
