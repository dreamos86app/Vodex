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
const cookieOpts = read("src/lib/auth/auth-cookie-options.ts");
const refCookie = read("src/lib/auth/ref-cookie.ts");
const routeHandler = read("src/lib/supabase/route-handler.ts");
const appOrigin = read("src/lib/url/app-origin.ts");

const suite = process.argv[2] ?? "all";

function runCookieOptionsLocalhost() {
  assert(cookieOpts.includes("getAuthCookieOptions"), "getAuthCookieOptions helper exists");
  assert(
    cookieOpts.includes("isLocalhostOrigin") && cookieOpts.includes("secure: !local"),
    "localhost disables Secure cookies",
  );
  assert(
    !cookieOpts.includes('domain: "dreamos86.com"') &&
      !cookieOpts.includes("domain: 'dreamos86.com'"),
    "no hardcoded dreamos86.com cookie domain",
  );
}

function runCookieOptionsProduction() {
  assert(
    cookieOpts.includes("secure: !local && https"),
    "production https enables Secure",
  );
  assert(cookieOpts.includes('sameSite: "lax"'), "sameSite lax");
  assert(cookieOpts.includes('path: "/"'), 'path "/"');
}

function runLocalhostNoSecure() {
  assert(refCookie.includes("getAuthCookieOptions"), "ref cookie uses getAuthCookieOptions");
  assert(oauthPrep.includes("getAuthCookieOptions"), "returnTo cookie uses getAuthCookieOptions");
  assert(!refCookie.match(/Secure.*localhost/), "no forced Secure on localhost in ref-cookie");
}

function runLocalhostNoDreamosDomain() {
  assert(
    !refCookie.includes("dreamos86.com") && !oauthPrep.includes("Domain=dreamos86"),
    "ephemeral cookies avoid dreamos86 domain attribute",
  );
}

function runCallbackNoFailReferral() {
  assert(
    callbackRoute.includes("resolvePostAuthDestination(null"),
    "callback does not require returnTo query",
  );
  assert(
    !callbackRoute.includes("dreamos_ref_code") ||
      !callbackRoute.match(/if\s*\(\s*!refCookie/),
    "callback does not fail when referral cookie missing",
  );
  assert(
    callbackRoute.includes("readRefCookieFromRequest") &&
      callbackRoute.includes("bootstrapProfileFromOAuth"),
    "referral is optional at bootstrap",
  );
}

function runCallbackReportsMissingRequired() {
  assert(
    callbackRoute.includes("createRouteHandlerClient"),
    "callback uses route-handler client bound to response",
  );
  assert(
    callbackRoute.includes("applyPendingAuthCookies"),
    "session cookies copied to final redirect",
  );
  assert(
    callbackRoute.includes("missing_required_cookie") ||
      callbackRoute.includes("missing_cookie"),
    "dev reports missing required PKCE cookie",
  );
  assert(
    callbackRoute.includes("diagnoseOAuthCallbackCookies"),
    "callback diagnoses cookie presence",
  );
}

function runWindowOriginLocal() {
  assert(
    oauthRedirect.includes("window.location.origin") ||
      oauthRedirect.includes("typeof window"),
    "oauth-redirect prefers browser origin",
  );
  assert(
    oauthPrep.includes("getCanonicalOAuthRedirectTo()"),
    "prepare uses canonical redirect from browser when available",
  );
  assert(
    appOrigin.includes("window.location.origin") &&
      appOrigin.includes("NEXT_PUBLIC_SITE_URL"),
    "app-origin avoids production SITE_URL in dev",
  );
  assert(!authTs.includes("skipBrowserRedirect"), "no dev skipBrowserRedirect override");
  assert(!authTs.includes("window.location.assign(result.data.url)"), "no manual OAuth redirect");
}

function runNormalGoogleLogin() {
  assert(authTs.includes("signInWithOAuth"), "Google OAuth preserved");
  assert(!authTs.includes("skipBrowserRedirect"), "Supabase handles browser redirect");
}

function runReferralGoogleLogin() {
  assert(oauthPrep.includes("persistReferralCodeForBrowser"), "referral stored in cookie");
  assert(
    !oauthPrep.match(/redirectTo.*\?ref=/),
    "referral not in redirectTo",
  );
}

const suites = {
  "oauth-cookie-options-localhost": runCookieOptionsLocalhost,
  "oauth-cookie-options-production": runCookieOptionsProduction,
  "oauth-localhost-no-secure-cookie": runLocalhostNoSecure,
  "oauth-localhost-no-dreamos-domain-cookie": runLocalhostNoDreamosDomain,
  "oauth-callback-does-not-fail-on-missing-referral-cookie": runCallbackNoFailReferral,
  "oauth-callback-reports-missing-required-cookie": runCallbackReportsMissingRequired,
  "oauth-uses-window-origin-for-local": runWindowOriginLocal,
  "normal-google-login-local": runNormalGoogleLogin,
  "referral-google-login-local": runReferralGoogleLogin,
};

function runAll() {
  Object.values(suites).forEach((fn) => fn());
  assert(routeHandler.includes("applyPendingAuthCookies"), "route-handler pending cookie helper");
}

if (suite === "all") {
  runAll();
} else if (suites[suite]) {
  suites[suite]();
} else {
  errors.push(`unknown suite: ${suite}`);
}

console.log(`\n=== verify:oauth-cookie-options${suite !== "all" ? ` (${suite})` : ""} ===\n`);
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
