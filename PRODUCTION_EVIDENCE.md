# Vodex P3.10 — Production Evidence Report

**Generated:** 2026-06-05 (local validation run)  
**Validator:** Automated + Supabase SQL probes + HTTP/Playwright against production  
**Production host:** `https://vodex.dev`  
**Supabase project:** `wciioegiczwqlmlroley` (55 migrations applied)

> This report documents **only what was actually executed and observed**. No synthetic success. Items marked **NOT PROVEN** were not validated in a real environment.

---

## Verified Readiness Score

| Category | Weight | Verified | Status |
|----------|--------|----------|--------|
| Android builder (APK/AAB) | 20 | 0 | **NOT PROVEN** |
| Mobile DB + readiness on prod | 15 | 0 | **NOT PROVEN** (migrations missing) |
| ZIP import + preview worker | 15 | 14 | **PROVEN** |
| Web publish (live URL) | 15 | 12 | **PROVEN** (HTTP + screenshot) |
| Publish health retry (Node) | 5 | 0 | **FAILED** locally |
| Staging Playwright suite | 10 | 4 | **PARTIAL** (contract-only, 2 failures) |
| Billing credit formula | 5 | 5 | **PROVEN** (unit test) |
| Live Paddle webhooks (30d) | 5 | 0 | **NOT PROVEN** |
| Notifications / email E2E | 10 | 0 | **NOT PROVEN** |
| Play Console acceptance | 10 | 0 | **NOT PROVEN** |

### **Verified Readiness Score: 35 / 100**

*(Theoretical P3.9 script score was 100/100 — that measured code contracts, not live proof.)*

---

## 1. Android Builder Validation

### Configuration check

| Check | Result |
|-------|--------|
| `WRAP_ANDROID_WEBHOOK_URL` in `.env.local` | **Absent** |
| Code path invokes external builder when URL set | **No** — route only checks env flag; does not POST to webhook |
| `mobile_build_jobs` table on production Supabase | **Does not exist** (`42P01`) |
| `mobile_app_configs` table on production Supabase | **Does not exist** |
| Android `wrap_jobs` rows | **0 rows** |

**Local migration present but not applied to production:**

- `supabase/migrations/20260629120000_mobile_wrapper_system.sql` defines `mobile_app_configs`, `mobile_build_jobs`, etc.

### APK / AAB generation

| Artifact | Generated | Size verified | Signing verified | Play Console |
|----------|-----------|---------------|------------------|--------------|
| APK | **NO** | — | — | — |
| AAB | **NO** | — | — | — |
| Wrapper ZIP (Capacitor) | **NOT RUN** (requires auth session + mobile tables) | — | — | — |

**Blockers before Android can be proven:**

1. Apply `20260629120000_mobile_wrapper_system.sql` (and dependent migrations) to production Supabase.
2. Deploy and connect a real Gradle/EAS builder at `WRAP_ANDROID_WEBHOOK_URL`.
3. Implement webhook dispatch + artifact callback verification in the build route (currently honesty-gated only).

---

## 2. Staging Playwright Execution

**Command run:**

```bash
PLAYWRIGHT_BASE_URL=https://vodex.dev PLAYWRIGHT_SKIP_SERVER=1 npx playwright test staging-production
```

**Important:** `staging-production.spec.ts` performs **static source-file contract checks**, not authenticated browser flows against the deployed UI. It does **not** log in, create apps, or click publish in production.

### Results

| Flow | Result | Duration | Notes |
|------|--------|----------|-------|
| A — create / generate / publish | **FAIL** | 20ms | Expects `CreationWorkspace`; prod code uses `CreatePageBody` |
| B — zip import / preview / publish | **PASS** | 18ms | Source contract only |
| C — readiness / wrapper / mobile | **PASS** | 6ms | Source contract only |
| D — notifications / broadcast | **PASS** | 7ms | Source contract only |
| E — billing upgrade | **FAIL** | 9ms | Stale assertion on `verify-credit-upgrade-examples.mjs` |

**Summary:** 3 passed, 2 failed, total wall time **2.8s**  
**Logs:** `tests/e2e/p310-staging-run.log`  
**JSON report:** `evidence/p310/playwright-report.json`

### Production screenshots (real browser)

Playwright screenshot CLI against live URLs (not auth-gated):

| File | URL | Size |
|------|-----|------|
| `evidence/p310/reciply-published.png` | `https://vodex.dev/p/reciplyy-mq01rwer` | 19 KB |
| `evidence/p310/platform-status.png` | `https://vodex.dev/status` | 31 KB |

---

## 3. Real App Validation — Reciply

**Test app:** `reciply TEST` (ZIP import, 1353 source files)

### Project & publish IDs

| Field | Value |
|-------|-------|
| Project ID | `59bf67fb-2203-4f3a-82e7-07f31a7dc4ad` |
| Project name | `reciply TEST` |
| Source | `zip_import` |
| File count | **1353** |
| Published app ID | `51c991b0-3e3f-4361-a0d6-2393c5c3788a` |
| Publish slug | `reciplyy-mq01rwer` |
| Public URL | `https://vodex.dev/p/reciplyy-mq01rwer` |
| Published at | `2026-06-04T22:17:29.154Z` |

### Step-by-step verification

| Step | Verified | Evidence |
|------|----------|----------|
| ZIP import | **YES** | `metadata.source = zip_import`, 1353 `app_files` rows |
| Preview build | **YES** | `preview_build_jobs.id = 2f327463-6448-404a-b4e1-5b4b10a6e0b1`, status `succeeded`, `preview_renderable = true`, finished in ~29s |
| Web publish | **YES** | `published_apps` row; HTTP **200** (PowerShell, 3984ms, 20,456 bytes) |
| Publish screenshot | **YES** | `evidence/p310/reciply-published.png` |
| Readiness scan | **NO** | `mobile_app_configs` table missing on production |
| RevenueCat audit | **NO** | Not executed (no mobile billing session in this pass) |
| SHA setup | **NO** | Not executed |
| Splash generation | **NO** | Not executed |
| Wrapper ZIP | **NO** | Not executed (mobile tables missing) |
| Android APK/AAB | **NO** | See §1 |
| Play Console | **NO** | No binary uploaded |

### Preview worker

| Field | Value |
|-------|-------|
| Worker ID | `railway-worker-1` |
| Status | `online` |
| Version | `0.1.0` |
| Last seen | `2026-06-05T07:35:05.168Z` |
| Preview job artifact path | `59bf67fb-2203-4f3a-82e7-07f31a7dc4ad/2f327463-6448-404a-b4e1-5b4b10a6e0b1` |

---

## 4. Publish Health (live probe)

### PowerShell `Invoke-WebRequest`

```
https://vodex.dev/p/reciplyy-mq01rwer -> 200 (3984ms, 20456 bytes)
https://vodex.dev/status                -> 200 (215ms)
https://vodex.dev/api/status/public     -> 200 (785ms)
```

### Node `verifyPublishedUrlHealthWithRetry`

**Result: FAILED** after full retry schedule (5s → 15s → 30s → 60s → 120s), total **226s**.

All 5 attempts returned `error: "fetch failed"` (Node `fetch` from this workstation). DNS and SSL flags reported OK; PowerShell succeeded on the same URL in the same session.

**Evidence:** `evidence/p310/publish-health-reciply.json`

> **Interpretation:** The published URL is reachable from the OS HTTP stack and Playwright, but Node fetch from the local validation environment failed consistently. Production publish-health should be re-verified from the deployment runtime (Vercel/Railway), not only from a developer machine.

---

## 5. Billing

| Check | Result |
|-------|--------|
| `mid-cycle-upgrade-credits-tests.ts` | **PASS** — `new_remaining = new_cap - used` |
| Paddle webhook events (30d) | **0** rows in `payment_webhook_events` |
| Live upgrade checkout | **NOT PROVEN** in this pass |

**Log:** `evidence/p310/billing-upgrade-test.log`

---

## 6. Notifications & Email

| Check | Result |
|-------|--------|
| Admin broadcast delivered | **NOT PROVEN** (no authenticated admin session in this pass) |
| Bell UI / unread counts | **NOT PROVEN** |
| Resend email delivery | **NOT PROVEN** |

No notification screenshots collected — requires owner login on production.

---

## 7. Artifact URLs (redacted / time-limited)

Production signed URLs are not included here (they expire). Stable public endpoints:

- Published app: https://vodex.dev/p/reciplyy-mq01rwer
- Platform status: https://vodex.dev/status
- Status API: https://vodex.dev/api/status/public

---

## 8. Remaining Blockers (production-grade)

1. **Apply mobile migrations** to production Supabase (`mobile_app_configs`, `mobile_build_jobs`, readiness tables).
2. **Connect `WRAP_ANDROID_WEBHOOK_URL`** to a real Gradle/EAS builder with artifact callback.
3. **Run authenticated E2E** on staging (`.playwright-auth.json` + real browser flows — current spec is contract-only).
4. **Fix staging contract drift** (Flow A: `CreatePageBody`; Flow E: credit test path).
5. **Re-run publish health** from Vercel serverless runtime, not local Node.
6. **Execute full Reciply mobile funnel** after migrations: readiness → RevenueCat → SHA → wrapper → Android build.
7. **Upload APK/AAB to Play Console internal track** to prove acceptance.

---

## 9. Evidence file index

```
evidence/p310/
├── reciply-published.png       # Live published app screenshot
├── platform-status.png       # Status page screenshot
├── publish-health-reciply.json # Node retry probe (failed)
├── billing-upgrade-test.log    # Credit formula unit test
└── playwright-report.json      # Playwright JSON (3/5 pass)

tests/e2e/p310-staging-run.log  # Full Playwright stdout
```

---

## 10. Score comparison

| Metric | Score | Basis |
|--------|-------|-------|
| P3.9 theoretical (script) | 100/100 | Static `verify:p39-production` |
| **P3.10 verified (this report)** | **35/100** | Live probes only |

**What is genuinely production-proven today:**

- ZIP import at scale (1353 files)
- Preview worker completing jobs with `preview_renderable = true`
- Web publish serving on `vodex.dev` with HTTP 200
- Preview worker heartbeat online
- Billing credit upgrade formula (unit level)

**What is not yet proven in production:**

- Real APK/AAB binaries
- Mobile readiness engine on a live project
- Play Console / App Store submission
- Authenticated staging E2E
- Live notification/email delivery
- Publish health retry from server runtime
