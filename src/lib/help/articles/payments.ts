import type { HelpArticle } from "@/lib/help/cms/types";

const PAYMENT_CHECKLIST = [
  { id: "account", label: "Merchant / developer account created" },
  { id: "sandbox", label: "Sandbox or test keys configured" },
  { id: "webhook", label: "Webhook endpoint configured" },
  { id: "test_checkout", label: "Test checkout completed" },
  { id: "live", label: "Live mode verified (when ready)" },
];

export const PAYMENT_ARTICLES: HelpArticle[] = [
  {
    slug: "stripe",
    categorySlug: "payments",
    title: "Stripe Payments Academy",
    description: "Sandbox to production: keys, webhooks, test checkout, subscriptions, and refunds.",
    category: "Payments",
    readMinutes: 18,
    difficulty: "intermediate",
    officialDocsUrl: "https://stripe.com/docs",
    relatedSlugs: ["integrations/stripe", "payments/provider-comparison"],
    checklist: PAYMENT_CHECKLIST,
    lastUpdated: "2026-05-19",
    keywords: ["sk_test", "pk_test", "whsec", "webhook"],
    content: `## How payments work in your Vodex app

1. Customer clicks checkout in **your published app**.
2. Your app calls Stripe (client + server) using **your** Stripe account.
3. Stripe charges the customer; webhooks notify Vodex/your backend.
4. Revenue events appear in **Dashboard → Insights** when webhooks are configured.

Vodex is **not** the merchant of record for your app sales.

## Sandbox guide

1. [Stripe Dashboard](https://dashboard.stripe.com) → toggle **Test mode**.
2. Copy \`pk_test_...\` and \`sk_test_...\`.
3. Vodex **Payments → Stripe** → mode **test**, paste keys.
4. Create a test Price in Stripe → use ID in **Test checkout**.
5. Card: \`4242 4242 4242 4242\`, any future expiry, any CVC.

## Production guide

1. Complete Stripe business verification.
2. Switch to \`pk_live_...\` / \`sk_live_...\` in Vodex, mode **live**.
3. Re-verify connection.
4. Update checkout URLs to production domain.

## Webhook guide

1. Stripe **Developers → Webhooks → Add endpoint**.
2. URL: your app's webhook route (shown in Vodex Payments panel).
3. Events: \`checkout.session.completed\`, \`customer.subscription.*\`, \`invoice.paid\`.
4. Copy signing secret (\`whsec_...\`) into Vodex.
5. Send test event — status should show webhook verified.

## Testing guide

- Use **Test connection** in Payments panel (validates keys).
- Use **Test checkout** with a test price ID.
- Mock mode in Integrations tests UI only — not live charges.

## Launch checklist

- [ ] Live keys saved and verified
- [ ] Webhook secret saved
- [ ] Test purchase in production with real card (small amount)
- [ ] Refund flow tested
- [ ] Terms + privacy linked on checkout

## Revenue analytics

Insights reads \`app_payment_events\` from verified webhooks. Without webhooks, revenue cards stay honest-empty.

## Refunds

Issue refunds in Stripe Dashboard or via API. Webhook \`charge.refunded\` updates analytics.

## Subscriptions

Use Stripe Products + Prices. Map price IDs in Vodex product mapping when enabled.

## Security

- Never expose \`sk_\` keys in browser.
- Rotate keys if leaked.
- Verify webhook signatures on every request.

## Provider comparison

See [Provider comparison](/help/payments/provider-comparison).
`,
  },
  {
    slug: "paypal",
    categorySlug: "payments",
    title: "PayPal Payments Academy",
    description: "Sandbox apps, client ID/secret, and going live.",
    category: "Payments",
    readMinutes: 14,
    difficulty: "intermediate",
    officialDocsUrl: "https://developer.paypal.com/docs",
    checklist: PAYMENT_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## How PayPal works

Customers redirect to PayPal to approve payment, then return to your app.

## Sandbox guide

1. [PayPal Developer](https://developer.paypal.com) → **Apps & Credentials**.
2. Create **Sandbox** app → copy Client ID + Secret.
3. Vodex Payments → PayPal → mode sandbox → save.
4. Use sandbox buyer accounts for test payments.

## Production guide

1. Create **Live** app after business verification.
2. Replace credentials in Vodex, mode live.
3. Verify token endpoint passes.

## Webhooks

Configure PayPal webhooks to your public URL. Save webhook ID/secret per PayPal docs.

## Testing

Run verify in Vodex. Complete a sandbox checkout from published app.

## Security

Store client secret server-side only (Vodex encrypts at rest).
`,
  },
  {
    slug: "paddle",
    categorySlug: "payments",
    title: "Paddle Payments Academy",
    description: "Paddle Billing for your app — separate from Vodex subscription Paddle.",
    category: "Payments",
    readMinutes: 14,
    difficulty: "intermediate",
    officialDocsUrl: "https://developer.paddle.com",
    checklist: PAYMENT_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Important distinction

| Account | Purpose |
|---------|---------|
| **Vodex Paddle** | Your subscription to Vodex (vodex.dev billing) |
| **Your app Paddle** | Your customers pay you |

Never mix API keys between them.

## Sandbox guide

1. Paddle sandbox vendor account.
2. API key from Paddle developer tools.
3. Vodex → Payments → Paddle → sandbox mode.

## Webhooks

Paddle notification destination → your app webhook URL. Save signing secret in Vodex.

## Subscriptions & tax

Paddle acts as merchant of record in supported regions — they handle VAT/sales tax.

## Testing

Verify API key shape in Vodex, then sandbox checkout.
`,
  },
  {
    slug: "lemon-squeezy",
    categorySlug: "payments",
    title: "Lemon Squeezy Payments Academy",
    description: "API key, store ID, webhooks, and digital products.",
    category: "Payments",
    readMinutes: 12,
    difficulty: "beginner",
    officialDocsUrl: "https://docs.lemonsqueezy.com",
    checklist: PAYMENT_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Lemon Squeezy is built for digital products, licenses, and SaaS.

## Setup

1. [Lemon Squeezy](https://lemonsqueezy.com) store.
2. **Settings → API** → create API key (JWT format).
3. Copy **Store ID** from store URL.
4. Vodex Payments → Lemon Squeezy → save both.

## Webhooks

Add webhook URL from Vodex panel. Verify signature secret.

## Testing

Test mode purchases in Lemon Squeezy dashboard before live.
`,
  },
  {
    slug: "revenuecat",
    categorySlug: "payments",
    title: "RevenueCat Payments Academy",
    description: "Mobile IAP, offerings, and entitlements.",
    category: "Payments",
    readMinutes: 16,
    difficulty: "intermediate",
    officialDocsUrl: "https://www.revenuecat.com/docs",
    relatedSlugs: ["mobile-apps/android-publishing", "mobile-apps/ios-publishing"],
    checklist: PAYMENT_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## How RevenueCat works

1. User purchases in App Store / Play Store.
2. Stores notify RevenueCat.
3. RevenueCat validates receipt and exposes entitlements to your app.
4. Optional: webhooks to your backend for server-side access control.

## Setup

1. Create [RevenueCat](https://app.revenuecat.com) project.
2. Link iOS + Android apps (bundle IDs / package names).
3. Configure products matching store listings.
4. Copy **public SDK key** (client) and **secret API key** (server).
5. Vodex **Mobile → RevenueCat wizard** or Payments panel.

## Sandbox testing

- iOS: Sandbox Apple ID.
- Android: license testers in Play Console.

## Webhooks

RevenueCat → Integrations → Webhooks → your URL.

## Analytics

Mobile revenue flows to Insights when events are ingested.
`,
  },
  {
    slug: "provider-comparison",
    categorySlug: "payments",
    title: "Payment Provider Comparison",
    description: "Choose the right provider for your business model.",
    category: "Payments",
    readMinutes: 8,
    difficulty: "beginner",
    lastUpdated: "2026-05-19",
    content: `## Comparison

| Provider | Best for | MoR | Mobile IAP |
|----------|----------|-----|------------|
| **Stripe** | SaaS, custom checkout | You | Via RevenueCat |
| **PayPal** | PayPal wallet users | You | Limited |
| **Paddle** | Global SaaS + tax | Paddle (regions) | No |
| **Lemon Squeezy** | Digital downloads | Lemon Squeezy | No |
| **RevenueCat** | iOS/Android subs | Stores | Yes |

## Recommendation

- **Web SaaS:** Stripe or Paddle.
- **Digital goods:** Lemon Squeezy.
- **Mobile subscriptions:** RevenueCat + store accounts.
`,
  },
];
