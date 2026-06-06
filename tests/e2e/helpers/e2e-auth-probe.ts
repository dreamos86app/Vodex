import fs from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";
import { AUTH_FILE } from "./live-gate";
import { writeRestaurantFinalFailure } from "./restaurant-final-failure";

const UUID_RE = /^[a-f0-9-]{36}$/i;

let cachedE2eAuthUserId: string | null = null;

const AUTH_API_TIMEOUT_MS =
  process.platform === "win32" ? 60_000 : 30_000;

function shouldReusePreparedAuth(): boolean {
  return (
    process.env.E2E_SKIP_BROWSER_AUTH_PROBE === "1" ||
    process.env.E2E_AUTH_CHECK_PASSED === "1"
  );
}

export type E2eAuthProbeResult = {
  ok: true;
  userId: string;
  email: string | null;
  creditsStatus: number;
  onboardingCompleted: boolean;
};

export type E2eAuthProbeFailure = {
  ok: false;
  code: "E2E_AUTH_UNRESOLVED" | "E2E_AUTH_STALE" | "E2E_AUTH_EMAIL_MISMATCH";
  message: string;
  authResponse: Record<string, unknown>;
  creditsStatus: number;
  cookieNames: string[];
};

function expectedEmail(): string | null {
  return process.env.E2E_TEST_EMAIL?.trim() || null;
}

async function readAuthSession(request: APIRequestContext) {
  const res = await request.get("/api/dev/auth-session-check", {
    timeout: AUTH_API_TIMEOUT_MS,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status(), body };
}

async function readCredits(request: APIRequestContext) {
  const res = await request.get("/api/credits?lite=1", { timeout: AUTH_API_TIMEOUT_MS });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status(), body };
}

async function readOnboarding(request: APIRequestContext) {
  const res = await request.get("/api/onboarding", { timeout: 30_000 }).catch(() => null);
  if (!res?.ok()) return { status: res?.status() ?? 0, completed: false };
  const body = (await res.json().catch(() => ({}))) as { completed?: boolean };
  return { status: res.status(), completed: body.completed === true };
}

function cookieNamesFromStorage(): string[] {
  try {
    const raw = fs.readFileSync(AUTH_FILE, "utf8");
    const parsed = JSON.parse(raw) as { cookies?: Array<{ name: string }> };
    return (parsed.cookies ?? []).map((c) => c.name).filter(Boolean);
  } catch {
    return [];
  }
}

/** Fast API-only auth — reuses cookies from e2e:auth:check (no browser navigation). */
export async function assertE2eAuthFromPreparedSession(
  request: APIRequestContext,
): Promise<E2eAuthProbeResult> {
  const auth = await readAuthSession(request);
  const credits = await readCredits(request);
  const onboarding = await readOnboarding(request);
  const cookieNames = cookieNamesFromStorage();

  const userResolved = auth.body.userResolved === true;
  const userId =
    typeof auth.body.userId === "string" && UUID_RE.test(auth.body.userId)
      ? auth.body.userId
      : null;

  if (!cookieNames.length) {
    throw new Error("auth_user_unresolved");
  }
  if (credits.status === 401 || !userResolved || !userId) {
    throw new Error("auth_user_unresolved");
  }
  if (!onboarding.completed) {
    throw new Error("auth_user_unresolved");
  }

  const creditsEmail =
    typeof credits.body.email === "string"
      ? credits.body.email
      : typeof (credits.body.user as { email?: string } | undefined)?.email === "string"
        ? (credits.body.user as { email: string }).email
        : null;

  const expected = expectedEmail();
  if (expected && creditsEmail && creditsEmail.toLowerCase() !== expected.toLowerCase()) {
    throw new Error("auth_user_unresolved");
  }

  cachedE2eAuthUserId = userId;

  return {
    ok: true,
    userId,
    email: creditsEmail ?? expected,
    creditsStatus: credits.status,
    onboardingCompleted: true,
  };
}

/** Establish origin session cookies, then verify auth APIs in the Playwright context. */
export async function probeE2eAuthInBrowserContext(input: {
  page: Page;
  request: APIRequestContext;
}): Promise<E2eAuthProbeResult | E2eAuthProbeFailure> {
  const cookieNames = cookieNamesFromStorage();
  const auth = await readAuthSession(input.request);
  const credits = await readCredits(input.request);

  await input.page.goto("/create", { waitUntil: "domcontentloaded", timeout: 120_000 }).catch(() => undefined);
  await input.page.waitForTimeout(300);
  const onboarding = await readOnboarding(input.request);

  const userResolved = auth.body.userResolved === true;
  const userId =
    typeof auth.body.userId === "string" && UUID_RE.test(auth.body.userId)
      ? auth.body.userId
      : null;

  const creditsEmail =
    typeof credits.body.email === "string"
      ? credits.body.email
      : typeof (credits.body.user as { email?: string } | undefined)?.email === "string"
        ? (credits.body.user as { email: string }).email
        : null;

  const onboardingCompleted = onboarding.completed === true;

  const baseFailure = {
    authResponse: auth.body,
    creditsStatus: credits.status,
    cookieNames,
  };

  if (!cookieNames.length) {
    return {
      ok: false,
      code: "E2E_AUTH_STALE",
      message: "No auth cookies in .playwright-auth.json — Run npm run e2e:auth:setup",
      ...baseFailure,
    };
  }

  if (credits.status === 401 || !userResolved || !userId) {
    return {
      ok: false,
      code: "E2E_AUTH_UNRESOLVED",
      message:
        credits.status === 401
          ? "/api/credits returned 401"
          : !userResolved
            ? "auth-session-check userResolved=false"
            : "auth-session-check missing userId",
      ...baseFailure,
    };
  }

  const expected = expectedEmail();
  if (expected && creditsEmail && creditsEmail.toLowerCase() !== expected.toLowerCase()) {
    return {
      ok: false,
      code: "E2E_AUTH_EMAIL_MISMATCH",
      message: `Expected ${expected}, got ${creditsEmail}`,
      ...baseFailure,
    };
  }

  if (!onboardingCompleted && onboarding.status !== 200) {
    return {
      ok: false,
      code: "E2E_AUTH_UNRESOLVED",
      message: `/api/onboarding returned ${onboarding.status} — run e2e:credits:prepare`,
      ...baseFailure,
    };
  }

  if (!onboardingCompleted) {
    return {
      ok: false,
      code: "E2E_AUTH_UNRESOLVED",
      message: "onboarding not completed — run npm run e2e:credits:prepare",
      ...baseFailure,
    };
  }

  return {
    ok: true,
    userId,
    email: creditsEmail ?? expected,
    creditsStatus: credits.status,
    onboardingCompleted: true,
  };
}

export async function assertE2eAuthInBrowserContext(input: {
  page: Page;
  request: APIRequestContext;
}): Promise<E2eAuthProbeResult> {
  const result = await probeE2eAuthInBrowserContext(input);
  if (result.ok) return result;

  await writeRestaurantFinalFailure({
    stage: "auth",
    code: result.code,
    message: result.message,
    url: input.page.url(),
    auth: {
      userResolved: result.authResponse.userResolved === true,
      userId: (result.authResponse.userId as string | null) ?? null,
      cookieNames: result.cookieNames,
      sessionError: (result.authResponse.sessionError as string | null) ?? null,
      creditsStatus: result.creditsStatus,
      onboardingCompleted: null,
    },
    page: input.page,
  });

  throw new Error(result.code);
}

/** Shared resolver for API helpers — reuses prepared session when auth:check already passed. */
export async function resolveAuthUserId(
  page: Page,
  request: APIRequestContext,
  knownUserId?: string | null,
): Promise<string | null> {
  const preset = knownUserId?.trim() || cachedE2eAuthUserId;
  if (preset && UUID_RE.test(preset)) return preset;

  if (shouldReusePreparedAuth()) {
    try {
      const session = await assertE2eAuthFromPreparedSession(request);
      return session.userId;
    } catch {
      throw new Error("auth_user_unresolved");
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
    const probe = await probeE2eAuthInBrowserContext({ page, request });
    if (probe.ok) {
      cachedE2eAuthUserId = probe.userId;
      return probe.userId;
    }
  }
  return null;
}
