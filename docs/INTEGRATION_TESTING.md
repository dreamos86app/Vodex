# Integration & Payment Testing (P4.7)

How to test Vodex integrations and app payments **without** connecting every live provider account.

## Modes

| Mode | Meaning |
|------|---------|
| **Mock** | Deterministic harness response — no external API calls. Never shown as live connected. |
| **Sandbox** | Real provider sandbox/test credentials (Stripe test keys, PayPal sandbox, etc.). |
| **Live** | Production merchant credentials — real money possible. |

## Test without accounts (mock)

1. Open **Dashboard → Integrations** for your app.
2. Click **Connect** on any provider (Stripe, Resend, OpenAI, etc.).
3. Select **Mock preview** mode.
4. Click **Test connection**.

Mock tests verify the harness, UI, and `app_integration_connections` writes. They do **not** prove live API access.

## Stripe (sandbox — no live merchant)

Use [Stripe test keys](https://dashboard.stripe.com/test/apikeys):

- `pk_test_…` publishable key
- `sk_test_…` secret key
- `whsec_…` webhook signing secret (from Stripe CLI or dashboard)

Save in **Payments → Stripe**, mode **test**, then **Verify** and **Test checkout** with a test price ID.

## PayPal (sandbox)

Use PayPal Developer **sandbox** app client ID + secret. Mode **sandbox**. Verify calls the sandbox token endpoint.

## Paddle (sandbox vs platform)

- **Your app's Paddle** — connect in Payments with sandbox API key. This is separate from Vodex platform billing Paddle.
- Do not confuse Vodex subscription Paddle with generated-app Paddle credentials.

## RevenueCat (sandbox)

Use a RevenueCat **sandbox** project API key. Offerings are checked only when credentials exist. Mobile billing wizard applies.

## GitHub & Supabase (live recommended)

These use OAuth or project keys against real services:

- **GitHub** — link Vodex account, quick-connect, then **Test** (live API).
- **Supabase** — connect modal + project picker (live project).

Mock mode is available but does not replace a real connection test before launch.

## Published app Google login

Requires live Google OAuth + Supabase redirect URL:

- **Central callback (recommended):** `https://vodex.dev/auth/callback` — one URL for all apps.
- Configure in Supabase → Authentication → URL configuration.
- Test in incognito on `/p/{slug}/login` after republish.

## Launch checklist (minimum live tests)

| Requirement | Live? |
|-------------|-------|
| Vodex platform Paddle | Live |
| One app payment provider | Sandbox or live |
| GitHub integration | Live |
| Supabase integration | Live / wizard |
| Resend | Live |
| Published Google login | Live (manual) |
| Android builder one AAB | Live build |

Everything else may be **mock verified**, **sandbox verified**, or documented as optional.

## API routes

- `POST /api/projects/[id]/integrations/[provider]/test` — integration harness
- `GET /api/projects/[id]/payments/readiness` — payment readiness cards
- `POST /api/public/[slug]/payments/[provider]/webhook` — app payment webhooks

## Impossible without external setup

- Live Apple Sign In custom credentials
- Live merchant approval (some regions)
- Production PayPal without business verification
- Real SMS/voice providers not in catalog
