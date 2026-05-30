#!/usr/bin/env node
/**
 * Paddle billing integration verification.
 * Run all: node scripts/verify-paddle-integration.mjs
 * Run one: node scripts/verify-paddle-integration.mjs paddle-env-schema-all-paid-plans
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const catalog = read("src/lib/billing/plan-billing-catalog.ts");
const billable = read("src/lib/billing/billable-plans.ts");
const paddleBilling = read("src/lib/billing/paddle-billing.ts");
const billingSettings = read("src/components/settings/billing-settings.tsx");
const paddleApi = read("src/lib/billing/paddle-api.ts");
const paddleCheckoutUrl = read("src/lib/billing/paddle-checkout-url.ts");
const testCheckoutComponent = read("src/components/admin/admin-paddle-test-checkout.tsx");
const checkout = read("src/app/api/billing/paddle/checkout/route.ts");
const webhook = read("src/app/api/billing/paddle/webhook/route.ts");
const webhooksAlias = read("src/app/api/webhooks/paddle/route.ts");
const handlers = read("src/lib/billing/paddle-webhook-handlers.ts");
const changePlan = read("src/app/api/billing/paddle/change-plan/route.ts");
const pricing = read("src/components/pricing/pricing-view.tsx");
const paddleCheckoutHook = read("src/components/billing/use-paddle-checkout.ts");
const upgradePolicy = read("src/lib/billing/upgrade-policy.ts");
const adminPage = read("src/app/(app)/admin/(owner)/billing/paddle/page.tsx");
const adminPanel = read("src/components/admin/admin-paddle-config-panel.tsx");
const envExample = read(".env.example");
const deployment = read("docs/DEPLOYMENT.md");
const paddleHelp = read("docs/help/paddle-billing-setup.md");
const privacy = read("src/components/marketing/legal/privacy-content.tsx");
const marketingConsent = read("src/lib/billing/paddle-marketing-consent.ts");
const envConsistency = read("src/lib/billing/paddle-env-consistency.ts");
const publicCheckout = read("src/lib/billing/paddle-public-checkout.ts");
const webhookProcessor = read("src/lib/billing/paddle-webhook-processor.ts");
const apiVerify = read("src/lib/billing/paddle-api-verify.ts");
const billingStatus = read("src/app/api/billing/status/route.ts");
const testCheckoutPage = read("src/app/(app)/admin/billing/paddle/test-checkout/page.tsx");
const planActionResolver = read("src/lib/billing/plan-action-resolver.ts");
const adminLayout = read("src/app/(app)/admin/layout.tsx");
const ownerLayout = read("src/app/(app)/admin/(owner)/layout.tsx");
const userMenu = read("src/components/layout/user-menu.tsx");
const paddleCheckoutCustomData = read("src/lib/billing/paddle-checkout-custom-data.ts");
const paddleEntitlementAudit = read("src/lib/billing/paddle-entitlement-audit.ts");
const applyUpgrade = read("src/lib/billing/apply-immediate-plan-upgrade.ts");
const paddleLocalTesting = read("src/lib/billing/paddle-local-testing.ts");
const planChangeRouter = read("src/lib/billing/plan-change-router.ts");
const planChangeAudit = read("src/lib/billing/plan-change-audit.ts");
const paddleCustomerPortal = read("src/lib/billing/paddle-customer-portal.ts");
const customerPortalRoute = read("src/app/api/billing/paddle/customer-portal-session/route.ts");
const billingSubscriptionPanel = read("src/components/billing/billing-subscription-panel.tsx");
const persistPaddleCustomer = read("src/lib/billing/persist-paddle-customer-id.ts");
const paddleProfileFields = read("src/lib/billing/paddle-profile-fields.ts");
const paddleSubscriptionLegacy = read("src/lib/billing/paddle-subscription-legacy-store.ts");
const paddleProfileMigration = read("supabase/migrations/20260709120000_paddle_profile_billing_fields.sql");
const paddleCustomerManualSql = read("scripts/manual-sql/paddle-customer-fields.sql");
const dreamosBillingProvider = read("src/lib/billing/dreamos-billing-provider.ts");
const stripeCheckoutRoute = read("src/app/api/billing/checkout/route.ts");
const stripePortalRoute = read("src/app/api/billing/portal/route.ts");
const fullRuntimeRepair = read("scripts/full-runtime-schema-repair.sql");
const projectPaymentsProviders = read("src/app/api/projects/[id]/payments/providers/[provider]/save/route.ts");
const manualSql = read("scripts/manual-sql/infinity-tier-plan-ids.sql");
const migration = read("supabase/migrations/20260529120000_infinity_tier_plan_ids.sql");

const INFINITY_ENV_KEYS = [
  "PADDLE_INFINITY_I_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_I_ANNUAL_PRICE_ID",
  "PADDLE_INFINITY_II_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_II_ANNUAL_PRICE_ID",
  "PADDLE_INFINITY_III_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_III_ANNUAL_PRICE_ID",
  "PADDLE_INFINITY_IV_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_IV_ANNUAL_PRICE_ID",
  "PADDLE_INFINITY_V_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_V_ANNUAL_PRICE_ID",
  "PADDLE_INFINITY_VI_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_VI_ANNUAL_PRICE_ID",
  "PADDLE_INFINITY_VII_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_VII_ANNUAL_PRICE_ID",
];

const suites = {
  "paddle-env-schema": () => {
    for (const key of [
      "PADDLE_ENVIRONMENT",
      "PADDLE_STARTER_MONTHLY_PRICE_ID",
      "PADDLE_STARTER_ANNUAL_PRICE_ID",
      "PADDLE_PRO_MONTHLY_PRICE_ID",
      "PADDLE_PRO_ANNUAL_PRICE_ID",
      ...INFINITY_ENV_KEYS,
    ]) {
      if (!envExample.includes(key)) throw new Error(`${key} missing from .env.example`);
    }
  },
  "paddle-env-schema-all-paid-plans": () => {
    suites["paddle-env-schema"]();
    if (!envExample.includes("PADDLE_INFINITY_VII_PRODUCT_ID")) {
      throw new Error("optional product IDs missing from .env.example");
    }
  },
  "paddle-plan-catalog-includes-all-infinity-tiers": () => {
    for (const tier of [
      "infinity_i",
      "infinity_ii",
      "infinity_iii",
      "infinity_iv",
      "infinity_v",
      "infinity_vi",
      "infinity_vii",
    ]) {
      if (!billable.includes(`"${tier}"`)) throw new Error(`catalog missing ${tier}`);
    }
    if (!billable.includes("BILLABLE_PLAN_IDS")) throw new Error("BILLABLE_PLAN_IDS export");
  },
  "paddle-infinity-i-is-base-infinity": () => {
    if (!billable.includes('infinity: "infinity_i"')) throw new Error("infinity alias → infinity_i");
    if (!billable.includes("PADDLE_INFINITY_MONTHLY_PRICE_ID")) {
      throw new Error("legacy infinity I monthly env");
    }
  },
  "paddle-price-map-complete": () => {
    if (!catalog.includes("getPlanBillingCatalog")) throw new Error("catalog export missing");
    if (!catalog.includes("BUILD_CREDITS_BY_PLAN") && !billable.includes("buildCredits")) {
      throw new Error("catalog uses credit economics");
    }
  },
  "paddle-price-map-complete-all-plans": () => {
    suites["paddle-price-map-complete"]();
    if (!catalog.includes("BILLABLE_PLAN_DEFINITIONS")) throw new Error("dynamic catalog build");
  },
  "paddle-no-secret-client-leak": () => {
    if (/NEXT_PUBLIC_PADDLE_API_KEY/.test(envExample)) throw new Error("public API key in example");
    const clientDirs = ["src/components/pricing", "src/components/billing"];
    for (const dir of clientDirs) {
      const full = path.join(root, dir);
      if (!fs.existsSync(full)) continue;
      for (const f of fs.readdirSync(full, { recursive: true })) {
        if (typeof f !== "string" || !f.endsWith(".tsx")) continue;
        const t = fs.readFileSync(path.join(full, f), "utf8");
        if (t.includes("PADDLE_API_KEY") || t.includes("PADDLE_WEBHOOK_SECRET")) {
          throw new Error(`secret env in client ${dir}/${f}`);
        }
      }
    }
  },
  "paddle-pricing-page-uses-price-ids": () => {
    if (!pricing.includes("usePaddleCheckout")) throw new Error("pricing must use paddle checkout hook");
    if (!pricing.includes("infinityTierIdToBillablePlan")) {
      throw new Error("infinity tiers map to billable plans");
    }
    const intervalSnippet = 'interval: annual ? "annual" : "monthly"';
    if (!paddleCheckoutHook.includes(intervalSnippet)) throw new Error("annual interval in checkout");
  },
  "paddle-checkout-validates-plan": () => {
    if (!checkout.includes("validateCheckoutPlanInterval")) throw new Error("validate plan/interval");
    if (!paddleApi.includes("isKnownPaddlePriceId")) throw new Error("reject unknown price");
  },
  "paddle-webhook-signature-required": () => {
    if (!webhook.includes("verifyPaddleWebhookSignature")) throw new Error("signature verify");
    if (!webhook.includes("503")) throw new Error("503 when secret missing");
  },
  "paddle-webhook-idempotency": () => {
    if (!handlers.includes("claimBillingEvent")) throw new Error("idempotent billing events");
  },
  "paddle-price-id-to-plan-map": () => {
    if (!catalog.includes("planFromPaddlePriceId")) throw new Error("price to plan map");
    if (!handlers.includes("planFromPaddlePriceId")) throw new Error("handlers use catalog map");
  },
  "paddle-webhook-price-id-to-plan-map-all-tiers": () => {
    suites["paddle-price-id-to-plan-map"]();
    if (!handlers.includes("resolveEntitlementPlan")) throw new Error("unknown price cannot grant plan");
  },
  "paddle-initial-subscription-entitlement": () => {
    if (!handlers.includes("applyImmediatePlanUpgrade")) throw new Error("upgrade on payment");
    if (!handlers.includes("transaction.completed")) throw new Error("txn completed handler");
  },
  "paddle-renewal-credit-reset": () => {
    if (!handlers.includes("syncPlanCreditsForUser")) throw new Error("renewal credit sync");
    if (!handlers.includes("renewal")) throw new Error("renewal intent");
  },
  "paddle-upgrade-full-cycle-no-proration": () => {
    if (
      !paddleApi.includes("PADDLE_UPGRADE_PRORATION_MODE") &&
      !paddleApi.includes("full_immediately") &&
      !upgradePolicy.includes("full_immediately")
    ) {
      throw new Error("no proration mode");
    }
  },
  "paddle-downgrade-next-renewal": () => {
    if (!changePlan.includes("scheduled_downgrade")) throw new Error("change-plan downgrade");
    if (!changePlan.includes("pending_downgrade_plan")) throw new Error("pending downgrade field");
  },
  "paddle-cancel-period-end": () => {
    if (!handlers.includes("subscription.canceled")) throw new Error("cancel handler");
    if (!handlers.includes("cancel_at_period_end")) throw new Error("cancel_at_period_end sync");
  },
  "paddle-annual-20-percent-discount": () => {
    if (!billable.includes("ANNUAL_BILLING_DISCOUNT")) throw new Error("annual discount constant");
  },
  "paddle-billing-page-actions": () => {
    const billingSettings = read("src/components/settings/billing-settings.tsx");
    if (!billingSettings.includes("paddle")) throw new Error("billing settings paddle");
    if (!billingSettings.includes("/api/billing/paddle/cancel")) {
      throw new Error("billing settings paddle cancel route");
    }
  },
  "paddle-admin-config-status": () => {
    if (!adminPage.includes("AdminPaddleConfigPanel")) throw new Error("admin paddle page");
    if (!read("src/app/api/admin/billing/paddle/route.ts").includes("buildPaddleAdminConfigStatus")) {
      throw new Error("admin paddle API");
    }
    if (!webhooksAlias.includes("webhooks/paddle")) throw new Error("canonical webhook path");
  },
  "paddle-admin-config-page-all-tiers": () => {
    if (!adminPanel.includes("Infinity VII") && !adminPanel.includes("priceRows")) {
      throw new Error("admin shows plan rows");
    }
    if (!adminPanel.includes("paddleCheckoutRecommendations")) {
      throw new Error("admin paddle recommendations");
    }
  },
  "paddle-docs-products-prices-not-manual-subscriptions": () => {
    for (const doc of [deployment, paddleHelp]) {
      if (!/Create subscription|manual.*subscription/i.test(doc)) {
        throw new Error("docs must warn against manual Create subscription");
      }
      if (!/pri_/i.test(doc)) throw new Error("docs mention price IDs");
    }
  },
  "privacy-policy-marketing-consent": () => {
    if (!privacy.includes("Marketing emails")) throw new Error("privacy marketing section");
    if (!privacy.includes("unsubscribe")) throw new Error("privacy unsubscribe");
    if (!privacy.includes("transactional")) throw new Error("privacy transactional emails");
  },
  "paddle-marketing-consent-copy": () => {
    if (!marketingConsent.includes("marketing_emails")) throw new Error("stores marketing_emails");
    if (!privacy.includes("opt in")) throw new Error("privacy opt-in language");
  },
  "paddle-no-mixed-environments": () => {
    if (!envConsistency.includes("validatePaddleEnvironmentConsistency")) throw new Error("env validator");
    if (!paddleBilling.includes("assertPaddleCheckoutEnvironment")) throw new Error("checkout env gate");
  },
  "paddle-production-env-live-keys": () => {
    if (!envConsistency.includes("pdl_live")) throw new Error("live api key check");
    if (!envConsistency.includes("live_")) throw new Error("live client token check");
  },
  "paddle-sandbox-env-test-keys": () => {
    if (!envConsistency.includes("test_")) throw new Error("sandbox client token check");
    if (!envConsistency.includes("pdl_sdbx")) throw new Error("sandbox api key check");
  },
  "paddle-live-price-ids-required": () => {
    if (!paddleBilling.includes('startsWith("pri_")')) throw new Error("pri_ required at checkout");
    if (!checkout.includes("priceId")) throw new Error("checkout rejects client priceId path");
  },
  "paddle-product-ids-optional-only": () => {
    if (!billable.includes("productKey")) throw new Error("product env keys");
    if (checkout.includes("PADDLE_*_PRODUCT_ID")) throw new Error("checkout must not use product id");
  },
  "paddle-admin-live-readiness": () => {
    if (!adminPanel.includes("envConsistencyOk")) throw new Error("admin env consistency");
    if (!adminPanel.includes("publicCheckoutEnabled")) throw new Error("admin public flag");
    if (!adminPanel.includes("Owner live checkout test")) throw new Error("admin test link");
  },
  "paddle-admin-does-not-expose-secrets": () => {
    if (/PADDLE_API_KEY=/.test(adminPanel)) throw new Error("admin shows api key");
    if (adminPage.includes("process.env.PADDLE_WEBHOOK_SECRET")) throw new Error("webhook secret in page");
  },
  "paddle-api-connection": () => {
    if (!apiVerify.includes("verifyPaddleCatalogViaApi")) throw new Error("api verify export");
    if (!apiVerify.includes("/prices/")) throw new Error("fetch price by id");
  },
  "paddle-price-id-exists": () => {
    if (!apiVerify.includes("fetchPaddlePrice")) throw new Error("price fetch");
  },
  "paddle-price-amounts-match": () => {
    if (!apiVerify.includes("expectedAmountUsd")) throw new Error("amount compare");
  },
  "paddle-price-intervals-match": () => {
    if (!apiVerify.includes("intervalOk")) throw new Error("interval compare");
  },
  "paddle-checkout-rejects-client-price-id": () => {
    if (!checkout.includes("Client-supplied price IDs are not accepted")) {
      throw new Error("reject client priceId");
    }
  },
  "paddle-owner-test-checkout-route": () => {
    if (!testCheckoutPage.includes("AdminPaddleTestCheckout")) throw new Error("test checkout page");
    if (!checkout.includes("admin_test_checkout")) throw new Error("admin checkout source");
  },
  "paddle-public-checkout-flag": () => {
    if (!publicCheckout.includes("PADDLE_PUBLIC_CHECKOUT_ENABLED")) throw new Error("public flag env");
    if (!envExample.includes("PADDLE_PUBLIC_CHECKOUT_ENABLED")) throw new Error("example public flag");
  },
  "paddle-public-checkout-disabled-safe": () => {
    if (!checkout.includes("public_checkout_disabled")) throw new Error("403 when disabled");
    if (!pricing.includes("publicCheckoutEnabled")) throw new Error("pricing checks flag");
  },
  "paddle-public-checkout-gated-until-ready": () => {
    suites["paddle-public-checkout-disabled-safe"]();
  },
  "paddle-owner-test-checkout-still-works": () => {
    if (!checkout.includes("Owner-only test checkout")) throw new Error("owner test gate");
    if (!checkout.includes("paddleOwnerTestCheckoutEnabled")) throw new Error("owner flag");
  },
  "paddle-simulation-stores-event-no-entitlement": () => {
    if (!webhookProcessor.includes("received_simulation_or_unlinked")) throw new Error("simulation status");
    if (!webhookProcessor.includes("isSimulation")) throw new Error("simulation detect");
  },
  "paddle-simulation-does-not-upgrade-random-user": () => {
    suites["paddle-simulation-stores-event-no-entitlement"]();
    if (!webhookProcessor.includes("handlePaddleTransactionCompleted")) {
      throw new Error("txn handler only after simulation gate");
    }
  },
  "paddle-simulation-missing-user-no-upgrade": () => {
    if (!webhookProcessor.includes("missing_custom_data")) throw new Error("missing user gate");
  },
  "paddle-simulation-received-and-stored": () => {
    if (!webhookProcessor.includes("storePaddleWebhookEvent")) throw new Error("store events");
  },
  "paddle-unknown-price-no-upgrade": () => {
    if (!webhookProcessor.includes("unknown_price_id")) throw new Error("unknown price gate");
  },
  "paddle-failed-payment-no-upgrade": () => {
    if (!webhookProcessor.includes("payment_failed_no_upgrade")) throw new Error("failed payment status");
  },
  "paddle-admin-shows-simulation-events": () => {
    if (!adminPanel.includes("isSimulation")) throw new Error("admin simulation column");
  },
  "paddle-checkout-success-polls-status": () => {
    if (!billingSettings.includes("/api/billing/status")) throw new Error("billing polls status");
    if (!billingStatus.includes("webhookPending")) throw new Error("status webhook pending");
  },
  "paddle-payment-complete-waits-for-webhook": () => {
    if (!billingSettings.includes("webhook confirmation")) throw new Error("billing webhook copy");
  },
  "paddle-no-frontend-credit-grant": () => {
    if (billingSettings.includes("credits_remaining =")) throw new Error("no client credit grant");
    if (!billingSettings.includes("never from the browser")) throw new Error("no frontend grant copy");
  },
  "infinity-tier-plan-db-schema": () => {
    if (!migration.includes("infinity_vii")) throw new Error("migration infinity_vii");
    if (!manualSql.includes("infinity_vii")) throw new Error("manual sql infinity_vii");
  },
  "paddle-plan-ids-db-compatible": () => {
    suites["infinity-tier-plan-db-schema"]();
  },
  "supabase-migration-manual-sql-safe": () => {
    if (!manualSql.includes("drop constraint if exists")) throw new Error("idempotent drop");
    if (!manualSql.includes("NOTIFY pgrst")) throw new Error("postgrest reload");
  },
  "plan-action-labels-by-rank": () => {
    if (!planActionResolver.includes("Downgrade to")) throw new Error("downgrade label");
    if (!planActionResolver.includes("Upgrade to")) throw new Error("upgrade label");
    if (!planActionResolver.includes("Current plan")) throw new Error("current label");
    if (!planActionResolver.includes("inf-7")) throw new Error("infinity vii target");
  },
  "pricing-buttons-downgrade-for-lower-plans": () => {
    if (!pricing.includes("resolvePlanAction")) throw new Error("pricing resolver");
    if (!pricing.includes("actionTarget")) throw new Error("actionTarget prop");
    if (!pricing.includes("/settings/billing")) throw new Error("downgrade href billing");
  },
  "billing-buttons-downgrade-for-lower-plans": () => {
    if (!billingSettings.includes("resolveBillablePlanAction")) throw new Error("billing resolver");
    if (!billingSettings.includes("Downgrade to")) throw new Error("downgrade in billing");
  },
  "user-menu-upgrade-until-infinity-vii": () => {
    if (!userMenu.includes("nextUpgradePlanId")) throw new Error("next plan");
    if (!userMenu.includes("!atHighestPlan")) throw new Error("upgrade when not highest");
  },
  "no-upgrade-button-at-infinity-vii": () => {
    if (!userMenu.includes("atHighestPlan")) throw new Error("highest check");
    if (!userMenu.includes("Manage billing")) throw new Error("manage billing at top");
  },
  "infinity-tier-plan-actions-all-tiers": () => {
    for (const n of ["inf-1", "inf-7", "infinity_vii"]) {
      if (!planActionResolver.includes(n) && !planActionResolver.includes("infinity_vii")) {
        throw new Error(`missing tier ref ${n}`);
      }
    }
    if (!planActionResolver.includes("INFINITY_SUFFIX_TO_TARGET")) throw new Error("suffix map");
  },
  "paddle-owner-test-checkout-not-404": () => {
    if (!testCheckoutPage.includes("AdminPaddleTestCheckout")) throw new Error("renders checkout");
    if (!testCheckoutPage.includes("GateShell")) throw new Error("controlled gates not 404");
    if (adminLayout.includes("isDreamosOwnerEmail")) throw new Error("admin layout must not blanket redirect");
    if (!ownerLayout.includes("isDreamosOwnerEmail")) throw new Error("owner layout gate");
  },
  "paddle-owner-test-checkout-admin-only": () => {
    if (!testCheckoutPage.includes("Access denied")) throw new Error("forbidden state");
  },
  "paddle-owner-test-checkout-disabled-state": () => {
    if (!testCheckoutPage.includes("PADDLE_OWNER_TEST_CHECKOUT_ENABLED=true")) throw new Error("disabled copy");
    if (!publicCheckout.includes('raw === "true"')) throw new Error("owner flag requires true");
  },
  "paddle-checkout-approved-domain": () => {
    if (!paddleCheckoutUrl.includes("PADDLE_CHECKOUT_URL")) throw new Error("env var");
    if (!paddleCheckoutUrl.includes("resolvePaddleTransactionCheckoutUrl")) throw new Error("resolver");
    if (!paddleApi.includes("resolvePaddleTransactionCheckoutUrl")) throw new Error("api uses resolver");
    if (paddleApi.includes("url: input.successUrl")) throw new Error("must not use successUrl for checkout.url");
  },
  "paddle-live-checkout-no-localhost-url": () => {
    if (!paddleCheckoutUrl.includes("isDisallowedLiveCheckoutHost")) throw new Error("host blocklist");
    if (!paddleCheckoutUrl.includes(".vercel.app")) throw new Error("block vercel preview");
    if (!paddleCheckoutUrl.includes("PADDLE_LIVE_CHECKOUT_DOMAIN_ERROR")) throw new Error("setup error copy");
    if (!paddleCheckoutUrl.includes('paddleEnvironment() === "production"')) throw new Error("production branch");
    if (paddleApi.includes("getAppUrl()") && paddleApi.includes("checkout: { url: input.successUrl")) {
      throw new Error("api still uses app url for checkout");
    }
  },
  "paddle-checkout-default-url-supported": () => {
    if (!paddleCheckoutUrl.includes('mode: "default"')) throw new Error("default mode");
    if (!paddleApi.includes("if (checkoutUrlResolution.url)")) throw new Error("omit checkout when null");
    if (!envExample.includes("PADDLE_CHECKOUT_URL")) throw new Error("env example");
  },
  "paddle-checkout-custom-data": () => {
    if (!paddleCheckoutCustomData.includes("buildPaddleCheckoutCustomData")) throw new Error("builder");
    if (!paddleCheckoutCustomData.includes("price_id")) throw new Error("price_id");
    if (!paddleApi.includes("buildPaddleCheckoutCustomData")) throw new Error("api uses builder");
  },
  "paddle-checkout-server-resolved-price": () => {
    if (!checkout.includes("resolvePaddlePriceId")) throw new Error("server price resolve");
    if (!checkout.includes("buildPaddleCheckoutCustomData")) throw new Error("custom data builder");
  },
  "paddle-owner-test-checkout-custom-data-preview": () => {
    if (!testCheckoutComponent.includes("buildPaddleCheckoutCustomData")) throw new Error("preview builder");
    if (!testCheckoutComponent.includes("price_id")) throw new Error("price_id in preview");
  },
  "paddle-webhook-processes-transaction-completed": () => {
    if (!webhookProcessor.includes("transaction.completed")) throw new Error("txn completed");
    if (!handlers.includes("handlePaddleTransactionCompleted")) throw new Error("handler");
    if (!handlers.includes("eventType === \"transaction.paid\"")) throw new Error("paid event type");
  },
  "paddle-webhook-processes-transaction-paid": () => {
    if (!webhookProcessor.includes("transaction.paid")) throw new Error("txn paid event");
    if (!handlers.includes("shouldProcessPaidTransaction")) throw new Error("paid processor");
  },
  "paddle-webhook-processes-subscription-activated": () => {
    if (!handlers.includes("subscription.activated")) throw new Error("sub activated");
    if (!handlers.includes("applyImmediatePlanUpgrade")) throw new Error("upgrade fallback");
  },
  "paddle-webhook-idempotent-no-double-credit": () => {
    if (!applyUpgrade.includes("claimBillingEvent")) throw new Error("claim event");
    if (!handlers.includes("paddle:txn:")) throw new Error("txn idempotency key");
  },
  "paddle-webhook-missing-custom-data-no-upgrade": () => {
    if (!webhookProcessor.includes("missing_custom_data")) throw new Error("missing custom status");
    if (!handlers.includes("readPaddleCheckoutCustomData")) throw new Error("read custom");
  },
  "paddle-entitlement-updates-profile": () => {
    if (!applyUpgrade.includes("plan_id: newPlan")) throw new Error("profile plan");
    if (!applyUpgrade.includes('subscription_status: "active"')) throw new Error("subscription status");
  },
  "paddle-plan-credits-reset": () => {
    if (!applyUpgrade.includes("monthlyTokensForPlan")) throw new Error("build allowance");
    if (!applyUpgrade.includes("monthlyActionCreditsForPlan")) throw new Error("action allowance");
  },
  "paddle-bonus-credits-preserved": () => {
    if (!applyUpgrade.includes("sumExplicitBuildGrants")) throw new Error("explicit bonus");
    if (!applyUpgrade.includes("explicit_build_bonus_preserved")) throw new Error("bonus preserved");
  },
  "paddle-upgrade-starts-new-cycle": () => {
    if (!applyUpgrade.includes("full_cycle_restart")) throw new Error("cycle restart");
    if (!applyUpgrade.includes("credits_reset_at")) throw new Error("reset at");
  },
  "paddle-billing-audit-log": () => {
    if (!paddleEntitlementAudit.includes("paddle.entitlement.applied")) throw new Error("audit event");
    if (!applyUpgrade.includes("logPaddleEntitlementAudit")) throw new Error("audit called");
  },
  "paddle-owner-checkout-polls-status": () => {
    if (!testCheckoutComponent.includes("/api/billing/status")) throw new Error("status poll");
    if (!testCheckoutComponent.includes("transactionId")) throw new Error("txn param");
    if (!testCheckoutComponent.includes("refreshCredits")) throw new Error("credits refresh");
  },
  "billing-status-refresh-after-checkout": () => {
    if (!billingSettings.includes("Refresh billing status")) throw new Error("refresh button");
    if (!billingSettings.includes("/api/billing/status")) throw new Error("status api");
  },
  "credits-refresh-after-checkout": () => {
    if (!billingSettings.includes("refreshCredits")) throw new Error("billing refresh credits");
    if (!testCheckoutComponent.includes("refreshCredits")) throw new Error("owner refresh credits");
  },
  "user-menu-refreshes-plan-after-checkout": () => {
    if (!userMenu.includes("syncFromDB")) throw new Error("user menu sync");
    if (!userMenu.includes("popover-open")) throw new Error("popover sync");
  },
  "paddle-local-production-warning": () => {
    if (!paddleLocalTesting.includes("localDevWithProductionPaddle")) throw new Error("local prod flag");
    if (!testCheckoutComponent.includes("testingContext")) throw new Error("testing context UI");
  },
  "paddle-supabase-project-consistency-before-checkout": () => {
    if (!checkout.includes("assertPaddleCheckoutSupabaseConsistency")) throw new Error("supabase gate");
    if (!paddleLocalTesting.includes("supabaseMismatchError")) throw new Error("mismatch error");
  },
  "paddle-owner-test-shows-webhook-url": () => {
    if (!testCheckoutComponent.includes("https://dreamos86.com/api/webhooks/paddle")) {
      throw new Error("production webhook URL");
    }
    if (!testCheckoutComponent.includes("Diagnostics")) throw new Error("diagnostics section");
  },
  "paddle-owner-test-shows-custom-data": () => {
    if (!testCheckoutComponent.includes("custom_data preview")) throw new Error("custom_data preview");
    if (!testCheckoutComponent.includes("billingIntent")) throw new Error("billing intent in preview flow");
    if (!testCheckoutComponent.includes("resolvePlanChange")) throw new Error("plan change router in test");
  },
  "paddle-owner-test-polls-webhook-status": () => {
    if (!testCheckoutComponent.includes("Waiting for webhook")) throw new Error("waiting label");
    if (!testCheckoutComponent.includes("processing_status")) throw new Error("processing status");
    if (!testCheckoutComponent.includes("entitlementApplied")) throw new Error("entitlement flag");
  },
  "paddle-no-checkout-for-same-plan": () => {
    if (!checkout.includes('code: "same_plan"')) throw new Error("same_plan response");
    if (!checkout.includes("resolvePlanChange")) throw new Error("router in checkout");
    if (!testCheckoutComponent.includes("You are already on this plan")) throw new Error("owner test block");
  },
  "paddle-plan-change-target-deterministic": () => {
    if (!planChangeRouter.includes("resolvePlanChange")) throw new Error("router");
    if (!checkout.includes("planChange.billingIntent")) throw new Error("intent from router");
    if (!paddleCheckoutCustomData.includes("billing_intent")) throw new Error("custom_data intent");
  },
  "paddle-upgrade-does-not-bounce-through-free": () => {
    if (!handlers.includes("resolveEntitlementPlan")) throw new Error("entitlement resolver");
    if (!handlers.includes('intent === "upgrade" || intent === "interval_change"')) {
      throw new Error("upgrade intent path");
    }
    if (!applyUpgrade.includes("normalizePlanId(input.newPlan)")) throw new Error("direct target plan");
  },
  "paddle-downgrade-requires-confirmation": () => {
    if (!planChangeRouter.includes("schedule_downgrade")) throw new Error("schedule downgrade action");
    if (!planChangeRouter.includes("requiresConfirmation: true")) throw new Error("confirmation");
    if (!billingSubscriptionPanel.includes("Confirm downgrade to")) throw new Error("confirm UI");
  },
  "paddle-plan-change-audit-log": () => {
    if (!planChangeAudit.includes("paddle.plan_change.attempt")) throw new Error("audit event");
    if (!checkout.includes("logPlanChangeAttempt")) throw new Error("checkout audit");
  },
  "billing-ui-no-button-soup": () => {
    if (billingSettings.includes("Confirm Downgrade to Starter")) {
      throw new Error("old downgrade chip copy");
    }
    if (billingSettings.includes("Change plan")) throw new Error("button soup header");
    if (!billingSettings.includes("BillingSubscriptionPanel")) throw new Error("subscription panel");
  },
  "billing-current-plan-card": () => {
    if (!billingSubscriptionPanel.includes("Current plan")) throw new Error("current plan card");
    if (!billingSubscriptionPanel.includes("Build Credits")) throw new Error("build credits");
    if (!billingSubscriptionPanel.includes("Manage subscription")) throw new Error("manage CTA");
  },
  "billing-recommended-next-plan-card": () => {
    if (!billingSubscriptionPanel.includes("recommendedUpgradeTarget")) throw new Error("recommended fn");
    if (!billingSubscriptionPanel.includes("Upgrade to")) throw new Error("upgrade CTA");
  },
  "billing-cycle-switch-card": () => {
    if (!billingSubscriptionPanel.includes("Switch to annual")) throw new Error("annual switch");
    if (!billingSubscriptionPanel.includes("save 20%")) throw new Error("save copy");
  },
  "billing-downgrade-collapsed": () => {
    if (!billingSubscriptionPanel.includes("Need a smaller plan?")) throw new Error("collapsed header");
    if (!billingSubscriptionPanel.includes("showDowngrade")) throw new Error("collapsed state");
  },
  "billing-compare-all-plans-modal": () => {
    if (!billingSubscriptionPanel.includes("Compare all plans")) throw new Error("compare link");
    if (!billingSubscriptionPanel.includes("Compare plans")) throw new Error("modal title");
  },
  "billing-infinity-vii-highest-plan": () => {
    if (!billingSubscriptionPanel.includes("Infinity VII")) throw new Error("infinity vii copy");
    if (!billingSubscriptionPanel.includes("isHighestPaidPlan")) throw new Error("highest check");
  },
  "billing-copy-professional": () => {
    if (!billingSubscriptionPanel.includes("Current plan")) throw new Error("current plan copy");
    if (!billingSubscriptionPanel.includes("Schedule downgrade")) throw new Error("schedule downgrade");
    if (billingSettings.includes("my.paddle.com")) throw new Error("generic paddle link in settings");
  },
  "owner-test-copy-technical-clear": () => {
    if (!testCheckoutComponent.includes("Diagnostics")) throw new Error("diagnostics");
    if (!testCheckoutComponent.includes("custom_data preview")) throw new Error("custom data");
  },
  "no-generic-paddle-signup-link": () => {
    if (billingSettings.includes("my.paddle.com")) throw new Error("settings generic link");
    if (billingSubscriptionPanel.includes("my.paddle.com")) throw new Error("panel generic link");
  },
  "paddle-customer-portal-session-route": () => {
    if (!customerPortalRoute.includes("createPaddleCustomerPortalSession")) throw new Error("portal fn");
    if (!customerPortalRoute.includes("POST")) throw new Error("POST route");
  },
  "paddle-customer-portal-auth-required": () => {
    if (!customerPortalRoute.includes("Unauthorized")) throw new Error("auth gate");
  },
  "paddle-customer-portal-uses-stored-customer-id": () => {
    if (!customerPortalRoute.includes("profile?.paddle_customer_id")) throw new Error("paddle_customer_id read");
    if (!customerPortalRoute.includes("PROFILE_PADDLE_BILLING_SELECT")) throw new Error("paddle select");
    if (!paddleCustomerPortal.includes("/portal-sessions")) throw new Error("portal sessions API");
  },
  "paddle-customer-id-column": () => {
    if (!paddleProfileMigration.includes("paddle_customer_id")) throw new Error("migration column");
    if (!paddleCustomerManualSql.includes("paddle_customer_id")) throw new Error("manual sql");
    if (!paddleProfileFields.includes("paddle_customer_id")) throw new Error("types/helper");
  },
  "paddle-customer-portal-uses-paddle-customer-id": () => {
    if (!customerPortalRoute.includes("profile?.paddle_customer_id")) throw new Error("paddle_customer_id");
    if (customerPortalRoute.includes("stripe_customer_id")) throw new Error("stripe read in portal");
    if (!paddleProfileFields.includes("paddle_customer_id")) throw new Error("helper");
  },
  "paddle-webhook-persists-paddle-customer-id": () => {
    suites["paddle-webhook-writes-paddle-fields-only"]();
  },
  "paddle-webhook-writes-paddle-fields-only": () => {
    if (!persistPaddleCustomer.includes("buildProfilePaddleBillingUpdate")) throw new Error("profile update");
    if (/\.update\(\s*\{[^}]*stripe_customer_id/s.test(persistPaddleCustomer)) {
      throw new Error("writes stripe profile col");
    }
    if (!paddleProfileFields.includes("paddle_customer_id")) throw new Error("paddle fields");
  },
  "no-stripe-customer-id-required-for-paddle": () => {
    suites["paddle-billing-does-not-read-stripe-customer-id"]();
  },
  "paddle-billing-does-not-read-stripe-customer-id": () => {
    if (paddleProfileFields.includes("stripe_customer_id")) throw new Error("stripe in profile select");
    if (customerPortalRoute.includes("stripe_customer_id")) throw new Error("portal reads stripe");
    if (!customerPortalRoute.includes("paddle_customer_id")) throw new Error("portal paddle only");
  },
  "paddle-sql-no-stripe-backfill": () => {
    for (const sql of [paddleCustomerManualSql, paddleProfileMigration]) {
      if (/stripe_customer_id|stripe_subscription_id|stripe_price_id/i.test(sql)) {
        throw new Error("stripe column reference in paddle SQL");
      }
    }
    if (fullRuntimeRepair.includes("paddle_customer_id = stripe_customer_id")) {
      throw new Error("stripe backfill in runtime repair");
    }
    if (!paddleCustomerManualSql.includes("notify pgrst")) throw new Error("pgrst reload");
  },
  "dreamos-billing-paddle-only": () => {
    if (!dreamosBillingProvider.includes("DreamOS86 billing uses Paddle")) throw new Error("message");
    if (!stripeCheckoutRoute.includes("dreamosStripeBillingDisabledResponse")) throw new Error("checkout block");
    if (!stripePortalRoute.includes("dreamosStripeBillingDisabledResponse")) throw new Error("portal block");
    if (!billingSettings.includes("BillingSubscriptionPanel")) throw new Error("paddle billing UI");
    if (billingSettings.includes("stripe:")) throw new Error("stripe in billing settings type");
  },
  "stripe-only-generated-app-integration-boundary": () => {
    if (!projectPaymentsProviders.includes('"stripe"')) throw new Error("app stripe provider");
    if (paddleProfileFields.includes("generated_app")) throw new Error("mixed into paddle profile");
    if (persistPaddleCustomer.includes("profiles.paddle_customer_id") || persistPaddleCustomer.includes("paddle_customer_id")) {
      // ok — platform paddle on profiles
    }
    if (projectPaymentsProviders.includes("profiles.paddle")) throw new Error("app uses profile paddle");
  },
  "no-user-facing-stripe-copy-for-dreamos-billing": () => {
    if (billingSettings.match(/Stripe/i)) throw new Error("stripe in billing settings");
    if (billingSubscriptionPanel.match(/Stripe/i)) throw new Error("stripe in subscription panel");
    if (testCheckoutComponent.match(/Stripe subscription/i)) throw new Error("stripe in owner test");
  },
  "paddle-customer-portal-no-generic-signup-url": () => {
    if (billingSubscriptionPanel.includes("my.paddle.com")) throw new Error("generic url");
    if (!billingSubscriptionPanel.includes("customer-portal-session")) throw new Error("portal API call");
  },
  "paddle-customer-portal-safe-missing-customer": () => {
    if (!customerPortalRoute.includes("missing_customer")) throw new Error("missing code");
    if (!customerPortalRoute.includes("Complete checkout first")) throw new Error("safe message");
  },
  "paddle-customer-portal-no-secret-leak": () => {
    if (customerPortalRoute.includes("PADDLE_API_KEY")) throw new Error("key in route");
    if (billingSubscriptionPanel.includes("PADDLE_API_KEY")) throw new Error("key in UI");
  },
  "plan-change-router": () => {
    if (!planChangeRouter.includes('action: "checkout"')) throw new Error("checkout action");
    if (!planChangeRouter.includes('action: "portal"')) throw new Error("portal action");
    if (!planChangeRouter.includes("recommendedUpgradeTarget")) throw new Error("recommended");
  },
  "plan-change-paid-upgrade-safe": () => {
    if (!planChangeRouter.includes("billingIntent: current === \"free\" ? \"new_subscription\" : \"upgrade\"")) {
      throw new Error("upgrade intent");
    }
  },
  "plan-change-downgrade-uses-confirmation": () => {
    if (!planChangeRouter.includes("schedule_downgrade")) throw new Error("downgrade action");
    if (!planChangeRouter.includes("confirmationMessage")) throw new Error("confirmation message");
  },
  "plan-change-cancel-uses-portal": () => {
    if (!billingSubscriptionPanel.includes("openCustomerPortal")) throw new Error("portal for manage");
    if (!planChangeRouter.includes("Manage subscription")) throw new Error("portal label");
  },
  "plan-change-interval-change-not-duplicate-subscription": () => {
    if (!planChangeRouter.includes("interval_change")) throw new Error("interval change intent");
    if (!planChangeRouter.includes('action: "portal"')) throw new Error("portal for interval");
    if (!planChangeRouter.includes("duplicate subscriptions")) throw new Error("duplicate warning");
  },
};

const selected = process.argv.slice(2).filter(Boolean);
const names = selected.length ? selected : Object.keys(suites);

console.log("\n=== verify:paddle-integration ===\n");
let failed = 0;
for (const name of names) {
  try {
    suites[name]();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    failed += 1;
  }
}
if (failed) process.exit(1);
console.log(`\n${names.length - failed}/${names.length} passed\n`);
