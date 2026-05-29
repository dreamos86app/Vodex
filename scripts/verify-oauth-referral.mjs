#!/usr/bin/env node
/**
 * OAuth + referral invariant checks (static).
 * Run individual suites via npm run verify:oauth-referral-* aliases.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else errors.push(msg);
}

const authTs = read("src/lib/auth.ts");
const oauthRedirect = read("src/lib/auth/oauth-redirect.ts");
const oauthPrep = read("src/lib/auth/oauth-prep.ts");
const callbackRoute = read("src/app/auth/callback/route.ts");
const loginView = read("src/components/auth/login-view.tsx");
const signupView = read("src/components/auth/signup-view.tsx");
const proxy = read("src/proxy.ts");

// ─── Fixed callback (no ref/next on redirectTo for OAuth) ───────────────────
assert(
  authTs.includes("prepareClientOAuthSignIn(returnTo, provider)"),
  "authSignInWithOAuth uses prepareClientOAuthSignIn",
);
assert(
  !authTs.includes("buildCallbackUrl(next)") && !authTs.includes("buildCallbackUrl(returnTo)"),
  "authSignInWithOAuth does not pass next into buildCallbackUrl",
);
assert(
  oauthRedirect.includes("getCanonicalOAuthCallbackUrl"),
  "canonical OAuth callback helper exists",
);
assert(
  oauthPrep.includes("getCanonicalOAuthCallbackUrl()") &&
    oauthPrep.includes("redirectTo: getCanonicalOAuthCallbackUrl()"),
  "prepareClientOAuthSignIn returns canonical redirectTo only",
);
assert(
  !oauthPrep.match(/redirectTo.*\?ref=/),
  "oauth-prep does not append ref to redirectTo",
);

// ─── Referral preserved via cookie/storage ─────────────────────────────────
assert(
  oauthPrep.includes("persistReferralCodeForBrowser") &&
    oauthPrep.includes("DREAMOS_REF_STORAGE_KEY"),
  "referral code persisted outside redirectTo",
);
assert(
  callbackRoute.includes("readRefCookieFromRequest") ||
    callbackRoute.includes("refCookie"),
  "callback reads referral cookie for attribution",
);
assert(
  oauthPrep.includes("DREAMOS_RETURN_TO_COOKIE"),
  "return path stored in cookie for post-auth redirect",
);

// ─── No open redirect ───────────────────────────────────────────────────────
assert(oauthPrep.includes("safeAuthReturnPath"), "safeAuthReturnPath helper exists");
assert(
  oauthPrep.includes('includes("://")') || oauthPrep.includes("includes('://')"),
  "safeAuthReturnPath rejects absolute URLs",
);
assert(
  loginView.includes("safeAuthReturnPath") && signupView.includes("safeAuthReturnPath"),
  "login/signup sanitize returnTo before OAuth",
);
assert(
  proxy.includes("safeAuthReturnPath") && proxy.includes('loginUrl.searchParams.set("next"'),
  "proxy sanitizes next when redirecting to login",
);

// ─── Site URL OAuth landing strips ref from callback forward ────────────────
assert(
  oauthRedirect.includes("OAUTH_CALLBACK_STRIP_PARAMS") &&
    oauthRedirect.includes('"ref"'),
  "buildAuthCallbackRedirectFromSearchParams strips ref from forwarded params",
);

// ─── Self-referral / invalid code (server) ──────────────────────────────────
const serverReferral = read("src/lib/referrals/server-referral.ts");
assert(
  serverReferral.includes("self_referral"),
  "server-referral blocks self-referral",
);

// ─── Normal login still uses OAuth entrypoints ──────────────────────────────
assert(
  loginView.includes("authSignInWithOAuth") && signupView.includes("authSignInWithOAuth"),
  "login and signup still expose OAuth",
);
assert(
  read("src/components/marketing/public-signup-section.tsx").includes("authSignInWithOAuth"),
  "public landing OAuth preserved",
);

const suite = process.argv[2] ?? "all";
const suites = {
  "fixed-callback": () => {
    assert(oauthPrep.includes("getCanonicalOAuthCallbackUrl()"), "canonical callback only");
  },
  "code-preserved": () => {
    assert(oauthPrep.includes("persistReferralCodeForBrowser"), "referral persisted");
  },
  "no-dynamic-referral-callback": () => {
    assert(!oauthPrep.includes("?ref="), "no ref query on oauth prep redirectTo");
  },
  "no-open-redirect": () => {
    assert(oauthPrep.includes("javascript:"), "blocks javascript: returnTo");
  },
  "attribution-after-google-login": () => {
    assert(callbackRoute.includes("bootstrapProfileFromOAuth"), "profile bootstrap after OAuth");
  },
  "self-referral-blocked": () => {
    assert(serverReferral.includes("self_referral"), "self referral blocked");
  },
  "invalid-code-safe": () => {
    assert(
      read("src/app/api/referrals/attribute/route.ts").includes("attachReferralByCode"),
      "attribute route handles invalid codes safely",
    );
  },
  "normal-login-still-works": () => {
    assert(authTs.includes("signInWithOAuth"), "signInWithOAuth still called");
  },
};

if (suite !== "all" && suites[suite]) {
  errors.length = 0;
  ok.length = 0;
  suites[suite]();
}

console.log(`\n=== verify:oauth-referral${suite !== "all" ? ` (${suite})` : ""} ===\n`);
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
