#!/usr/bin/env node
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
const proxy = read("src/proxy.ts");
const referralGuard = read("src/components/referrals/referral-guard.tsx");
const referralCapture = read("src/components/referrals/referral-capture.tsx");
const attributeRoute = read("src/app/api/referrals/attribute/route.ts");
const serverReferral = read("src/lib/referrals/server-referral.ts");

const suite = process.argv[2] ?? "all";

function runAll() {
  assert(
    oauthRedirect.includes("getCanonicalOAuthRedirectTo"),
    "getCanonicalOAuthRedirectTo exists",
  );
  assert(
    oauthRedirect.includes("assertCanonicalOAuthRedirectTo"),
    "assertCanonicalOAuthRedirectTo exists",
  );
  assert(
    authTs.includes("prepareClientOAuthSignIn") && !authTs.match(/buildCallbackUrl\(.*returnTo/),
    "authSignInWithOAuth uses prepareClientOAuthSignIn without buildCallbackUrl(next)",
  );
  assert(
    oauthPrep.includes("getCanonicalOAuthRedirectTo()") &&
      oauthPrep.includes("blocked: true"),
    "prepareClientOAuthSignIn blocks when authenticated",
  );
  assert(
    !oauthPrep.includes("?next=") || oauthPrep.includes("redirectTo_must_not"),
    "oauth-prep does not build redirectTo with next query",
  );
  assert(
    oauthPrep.includes("persistReferralCodeForBrowser") ||
      oauthPrep.includes("captureReferralFromLocationSearch"),
    "referral persisted outside redirectTo",
  );
  assert(
    oauthRedirect.includes("OAUTH_CALLBACK_ALLOW_PARAMS") &&
      oauthRedirect.includes("OAUTH_CALLBACK_DENY_PARAMS"),
    "callback forward uses allow/deny param lists",
  );
  assert(
    oauthRedirect.includes('"ref"') && oauthRedirect.includes('"next"'),
    "ref and next denied on callback forward",
  );
  assert(
    callbackRoute.includes("resolvePostAuthDestination(null"),
    "callback ignores next query param",
  );
  assert(
    proxy.includes("redirectLoggedInReferralAttempt") &&
      proxy.includes("existing_user"),
    "proxy redirects logged-in referral to home with notice",
  );
  assert(
    referralGuard.includes("clearPendingReferralForBrowser"),
    "referral guard clears pending referral for logged-in users",
  );
  assert(
    referralCapture.includes("hasActiveSession") &&
      referralCapture.includes("onboarding_completed"),
    "referral capture skips logged-in / completed users",
  );
  assert(
    attributeRoute.includes("existing_user"),
    "attribute API rejects existing users",
  );
  assert(
    serverReferral.includes("self_referral"),
    "self-referral blocked server-side",
  );
  assert(
    oauthPrep.includes("logSupabaseAuthorizeUrl") ||
      authTs.includes("logSupabaseAuthorizeUrl"),
    "dev authorize URL diagnostics",
  );
}

const suites = {
  "redirect-canonical-only": () => {
    assert(oauthRedirect.includes("assertCanonicalOAuthRedirectTo"), "assert helper");
    assert(authTs.includes("getCanonicalOAuthRedirectTo"), "canonical export");
  },
  "referral-never-in-redirect-to": () => {
    assert(!oauthPrep.match(/redirectTo.*\?ref=/), "no ref in redirectTo");
    assert(oauthPrep.includes("getCanonicalOAuthRedirectTo()"), "canonical redirectTo");
  },
  "return-to-stored-not-query": () => {
    assert(oauthPrep.includes("persistAuthReturnToForBrowser"), "returnTo in cookie/storage");
    assert(callbackRoute.includes("resolvePostAuthDestination(null"), "callback no next query");
  },
  "callback-strips-ref-query": () => {
    assert(oauthRedirect.includes("OAUTH_CALLBACK_DENY_PARAMS"), "deny list");
    assert(oauthRedirect.includes('"ref"'), "strips ref");
  },
  "logged-in-referral-does-not-start-oauth": () => {
    assert(oauthPrep.includes("blocked: true"), "oauth blocked when signed in");
    assert(referralGuard.includes("ReferralGuard"), "guard component");
  },
  "logged-in-referral-shows-message": () => {
    assert(
      read("src/lib/referrals/referral-messages.ts").includes("existing_user"),
      "existing_user message",
    );
    assert(proxy.includes("REFERRAL_NOTICE_QUERY"), "proxy sets notice query");
  },
  "logged-out-referral-allows-signup": () => {
    assert(referralCapture.includes("captureReferralFromLocationSearch"), "captures when logged out");
  },
  "logged-out-referral-google-oauth": () => {
    assert(authTs.includes("signInWithOAuth"), "oauth entry");
    assert(oauthRedirect.includes("getCanonicalOAuthRedirectTo"), "canonical callback");
  },
  "referral-applied-only-new-user": () => {
    assert(
      read("src/lib/auth/profile-bootstrap.ts").includes("canAcceptReferral"),
      "bootstrap gates referral on new/incomplete users",
    );
  },
  "existing-user-cannot-add-referral": () => {
    assert(attributeRoute.includes("existing_user"), "API blocks existing users");
  },
  "self-referral-blocked": () => {
    assert(serverReferral.includes("self_referral"), "self referral");
  },
  "invalid-referral-nonblocking": () => {
    assert(
      read("src/lib/referrals/referral-messages.ts").includes("invalid_code"),
      "invalid code message",
    );
  },
  "no-open-redirect": () => {
    assert(oauthPrep.includes("javascript:"), "blocks javascript URLs");
  },
  "normal-login-still-works": () => {
    assert(authTs.includes("signInWithOAuth"), "oauth preserved");
  },
};

if (suite === "all") {
  runAll();
} else if (suites[suite]) {
  suites[suite]();
} else {
  errors.push(`unknown suite: ${suite}`);
}

console.log(`\n=== verify:oauth-referral${suite !== "all" ? ` (${suite})` : ""} ===\n`);
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
