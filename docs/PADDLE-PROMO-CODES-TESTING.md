# Paddle promo codes — owner test checkout

Use real Paddle discounts to exercise the full checkout → webhook → entitlement path without paying full price.

## 1. Create discounts in Paddle

**Paddle Dashboard → Catalog → Discounts → New discount**

Create at least one test discount:

| Name | Code | Type | Amount | Notes |
|------|------|------|--------|--------|
| Vodex Test 100 | `VODEXTEST100` | Percentage | 100% | Full discount for internal testing |
| Vodex Test 90 | `VODEXTEST90` | Percentage | 90 | Optional |
| Vodex Test 50 | `VODEXTEST50` | Percentage | 50 | Optional |

Recommended settings:

- **Enabled for checkout:** Yes
- **Restrict to:** Your Starter / Pro / Infinity price IDs used in Vodex
- **Usage limit:** Low (e.g. 10–50) for internal testing
- **Expires at:** Optional short expiry for safety

Repeat in **Sandbox** and **Production** if you test both environments.

## 2. Test in Vodex

1. Sign in as platform owner (`vodexlabs@gmail.com`).
2. Open **Admin → Billing → Paddle → Test checkout**.
3. Select plan + interval.
4. Choose a preset (`VODEXTEST100`, etc.) or type the code.
5. Start checkout — Vodex passes the code to Paddle on `POST /transactions`.
6. Complete Paddle checkout.

## 3. Success criteria

A promo test is valid **only** when all of the following are true:

- Paddle transaction completes (not merely checkout opened)
- Webhook returns **200** to `https://vodex.dev/api/webhooks/paddle`
- Billing attempt inspector shows entitlement applied
- Profile plan / credits / period match the purchased plan

If Paddle rejects the code, the API returns an error like `Paddle rejected discount: …` — fix the code in Paddle (typo, expiry, wrong price restriction).

## 4. Cleanup

Disable or delete test discounts in Paddle when finished, or set strict usage limits.

## 5. API

`POST /api/billing/paddle/action` accepts optional:

```json
{
  "plan": "starter",
  "interval": "monthly",
  "confirmed": true,
  "testMode": true,
  "source": "admin_test_checkout",
  "promoCode": "VODEXTEST100"
}
```

Do **not** send both `promoCode` and `discountId` — Paddle allows only one.
