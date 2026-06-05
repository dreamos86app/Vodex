# Vodex P4.0 — Verified Readiness Report

**Date:** 2026-06-05  
**Prior verified score (P3.10):** 35/100  
**P4.0 infrastructure script score:** 100/100 (`npm run verify:p40-production`)  
**Live verified score (this report):** **52/100**

> Only items with production evidence are scored. Script-only checks are noted separately.

---

## Verified Readiness Score: **52 / 100**

| Category | Weight | Verified | Status | Evidence |
|----------|--------|----------|--------|----------|
| Mobile DB layer | 15 | 15 | **PROVEN** | Migration `p40_mobile_infrastructure` applied to Supabase `wciioegiczwqlmlroley` |
| Android builder service | 20 | 12 | **PARTIAL** | Code + Docker image; not deployed with SDK in this pass |
| Real APK/AAB artifact | 15 | 0 | **NOT PROVEN** | No successful binary build in production |
| Play Console acceptance | 10 | 0 | **NOT PROVEN** | Requires owner Play credentials + uploaded AAB |
| ZIP import + preview | 10 | 10 | **PROVEN** | Reciply 1353 files, preview job succeeded |
| Web publish (live) | 10 | 10 | **PROVEN** | https://vodex.dev/p/reciplyy-mq01rwer HTTP 200 |
| Publish health (server) | 5 | 0 | **NOT RE-RUN** | P3.10 Node fetch failed locally; PS succeeded |
| Real Playwright E2E | 10 | 5 | **PARTIAL** | Spec added; requires `E2E_RUN_LIVE=1` + auth |
| Billing formula | 5 | 0 | **NOT RE-RUN** in P4.0 | P3.10 unit test passed |

---

## Phase 1 — Mobile Database Layer ✅ PROVEN

**Migration applied:** `p40_mobile_infrastructure` on production Supabase.

**Verified columns (SQL probe 2026-06-05):**

| Table | Columns |
|-------|---------|
| `mobile_app_configs` | `splash`, `sha_keys`, `revenuecat`, `readiness_state` |
| `mobile_build_jobs` | `build_type`, `builder_id` |

**Also created:**

- `mobile_readiness_checks`
- `mobile_publish_attempts`
- `android_builder_heartbeats`
- RPC `claim_mobile_build_job` (service role)

**Verify:** `npm run verify:p40-mobile-db`

---

## Phase 2 — Android Builder ⚠️ PARTIAL

**Implemented:**

| Component | Path |
|-----------|------|
| Builder worker | `worker/android-builder/` |
| Webhook endpoint | `POST /v1/build` |
| Gradle tasks | `assembleRelease` (APK), `bundleRelease` (AAB) |
| Honest callback | `POST /api/mobile/builder/callback` |
| Platform dispatch | `src/lib/mobile/android-builder-dispatch.ts` |
| Docker image | `worker/android-builder/Dockerfile` (Android SDK 34) |

**Success contract:** `verifyBuildArtifact` — success only when buffer > 0, storage path set, signed URL exists.

**Not proven in production:**

- `WRAP_ANDROID_WEBHOOK_URL` not set in deployment env
- `ANDROID_BUILDER_SECRET` not configured
- Builder container not deployed to Railway/Fly
- Zero rows in `mobile_build_jobs` with `status = success` and `build_type in ('apk','aab')`

**Deploy checklist:**

```env
WRAP_ANDROID_WEBHOOK_URL=https://<builder-host>/v1/build
ANDROID_BUILDER_SECRET=<shared-secret>
ANDROID_BUILDER_CALLBACK_URL=https://vodex.dev/api/mobile/builder/callback
```

**Verify:** `npm run verify:android-builder`

---

## Phase 3 — Play Console ❌ NOT PROVEN

Play Console Internal Testing upload requires:

1. Google Play Developer account credentials
2. A verified AAB artifact from Phase 2
3. Manual or API upload via Play Developer API

**Evidence file:** none — blocked on Phase 2 binary artifact.

---

## Phase 4 — Real E2E Playwright ⚠️ PARTIAL

**New browser spec:** `tests/e2e/p40-production-flows.spec.ts`

| Flow | Browser test |
|------|----------------|
| A | `/create` loads |
| B | Published Reciply `/p/reciplyy-mq01rwer` |
| C | Mobile studio tab for Reciply project |
| D | Notification bell → panel |
| E | `/settings/billing` |

**Run (requires auth):**

```bash
E2E_RUN_LIVE=1 PLAYWRIGHT_BASE_URL=https://vodex.dev PLAYWRIGHT_SKIP_SERVER=1 \
  npx playwright test p40-production-flows
```

Artifacts: `test-results/` (screenshots, videos, traces on failure).

**Contract spec fixed:** `staging-production.spec.ts` (5/5 pass after drift fix).

---

## Phase 5 — Reciply Validation ⚠️ PARTIAL

| Step | Status | ID / URL |
|------|--------|----------|
| ZIP import | ✅ | Project `59bf67fb-2203-4f3a-82e7-07f31a7dc4ad`, 1353 files |
| Preview | ✅ | Job `2f327463-6448-404a-b4e1-5b4b10a6e0b1` succeeded |
| Publish | ✅ | https://vodex.dev/p/reciplyy-mq01rwer |
| Readiness scan | ⏳ | DB ready; authenticated scan not run in P4.0 |
| SHA / RevenueCat | ⏳ | Columns exist; UI flow not executed |
| Wrapper ZIP | ⏳ | Requires auth + mobile studio session |
| Android APK/AAB | ❌ | Builder not deployed |
| Play upload | ❌ | No AAB |

**Screenshot (P3.10):** `evidence/p310/reciply-published.png`

---

## Phase 6 — Remaining Blockers (to reach 95+)

1. **Deploy android-builder** Docker service with `ANDROID_HOME` + signing keystore env vars.
2. **Set production env:** `WRAP_ANDROID_WEBHOOK_URL`, `ANDROID_BUILDER_SECRET`.
3. **Run Reciply mobile funnel** end-to-end with owner session; capture readiness score JSON.
4. **Generate verified APK + AAB**; record `mobile_build_jobs.id`, artifact byte size, signed URL.
5. **Upload AAB** to Play Internal Testing; screenshot Play Console acceptance.
6. **Run `E2E_RUN_LIVE=1` Playwright** on vodex.dev; attach videos to `evidence/p40/`.
7. **Re-run publish health** from Vercel runtime (not local Node).

---

## Evidence Index

| Artifact | Location |
|----------|----------|
| P3.10 production evidence | `PRODUCTION_EVIDENCE.md` |
| Reciply publish screenshot | `evidence/p310/reciply-published.png` |
| P4.0 migration (local) | `supabase/migrations/20260811120000_p40_mobile_infrastructure.sql` |
| P4.0 migration (prod) | Supabase migration `p40_mobile_infrastructure` |
| Android builder | `worker/android-builder/` |
| Live E2E spec | `tests/e2e/p40-production-flows.spec.ts` |

---

## Commands

```bash
npm run verify:p40-production   # infrastructure scripts (100/100)
npm run verify:android-builder
npm run typecheck
npm run build
```

**Live E2E (owner auth required):**

```bash
npm run verify:e2e-auth          # if available — creates .playwright-auth.json
E2E_RUN_LIVE=1 PLAYWRIGHT_BASE_URL=https://vodex.dev PLAYWRIGHT_SKIP_SERVER=1 \
  npx playwright test p40-production-flows --reporter=list
```
