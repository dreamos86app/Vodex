# Paddle billing setup (DreamOS86 platform)

DreamOS86 subscriptions (not generated-app payments) use **Paddle Billing** with **Price IDs** (`pri_*`).

## Environment variables

Copy from `.env.example` into `.env.local` and Vercel Production:

- `PADDLE_ENVIRONMENT` — `sandbox` or `production`
- `PADDLE_API_KEY` — server only
- `PADDLE_WEBHOOK_SECRET` — server only
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` — safe for Paddle.js
- Monthly + annual `pri_*` IDs for Starter, Pro, and Infinity I–VII

Optional `PADDLE_*_PRODUCT_ID` (`pro_*`) for admin/debug only.

## Catalog steps

1. Go to **Paddle → Catalog → Products**.
2. Create one product per plan (Starter, Pro, Infinity I … VII). Tax category: **SaaS**.
3. Inside each product, create:
   - **Monthly** recurring price
   - **Annual** recurring price (20% off 12 monthly payments)
4. Copy each **Price ID** into the matching env var.
5. Set webhook URL: `https://dreamos86.com/api/webhooks/paddle`
6. Redeploy after env changes.

## Checkout settings (recommended)

| Setting | Recommendation |
|---------|----------------|
| Saving payment methods | ON |
| Marketing consent | ON (optional opt-in; Privacy Policy covers marketing + unsubscribe) |
| Checkout discounts | ON if using coupons |

Suggested marketing opt-in text:

> DreamOS86 may send me product updates, onboarding tips, and offers by email. I can unsubscribe at any time.

## Important: do not use manual “Create subscription”

Paddle’s **Create subscription** screen is for manually billing an **existing** customer. Normal DreamOS86 users subscribe via **Products + Prices + checkout** (`/pricing` → Paddle checkout).

## Verify

```bash
npm run typecheck
npm run verify:paddle-integration
```

Owner admin: `/admin/billing/paddle`
