/**
 * P1.3.7 — Auth session UX state machine (client).
 * Prevents login redirect flash during token refresh.
 */

export type AuthUxState =
  | "loading_initial_session"
  | "refreshing_session"
  | "authenticated"
  | "unauthenticated_confirmed";

export type AuthDebugEvent =
  | "initial_session_loaded"
  | "token_refresh_started"
  | "token_refresh_success"
  | "get_user_transient_failure"
  | "unauthenticated_confirmed"
  | "redirect_to_login_blocked_due_refresh"
  | "redirect_to_next_after_valid_session";

const AUTH_FAILURE_THRESHOLD = 3;
const AUTH_FAILURE_WINDOW_MS = 4_000;

let uxState: AuthUxState = "loading_initial_session";
let refreshInFlight = false;
let transientFailures = 0;
let firstFailureAt = 0;
const listeners = new Set<(s: AuthUxState) => void>();

export function getAuthUxState(): AuthUxState {
  return uxState;
}

export function subscribeAuthUxState(cb: (s: AuthUxState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setUxState(next: AuthUxState) {
  if (uxState === next) return;
  uxState = next;
  for (const cb of listeners) cb(next);
}

export function emitAuthDebugEvent(
  event: AuthDebugEvent,
  detail?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("auth_debug_event", { detail: { event, ...detail, at: Date.now() } }),
    );
  } catch {
    /* ignore */
  }
  if (process.env.NODE_ENV === "development") {
    console.debug("[auth_debug_event]", event, detail ?? "");
  }
}

export function markInitialSessionLoaded(hasUser: boolean) {
  transientFailures = 0;
  setUxState(hasUser ? "authenticated" : "unauthenticated_confirmed");
  emitAuthDebugEvent("initial_session_loaded", { hasUser });
}

export function markTokenRefreshStarted() {
  refreshInFlight = true;
  setUxState("refreshing_session");
  emitAuthDebugEvent("token_refresh_started");
}

export function markTokenRefreshSuccess() {
  refreshInFlight = false;
  transientFailures = 0;
  setUxState("authenticated");
  emitAuthDebugEvent("token_refresh_success");
}

export function recordGetUserTransientFailure(error?: string) {
  const now = Date.now();
  if (!firstFailureAt || now - firstFailureAt > AUTH_FAILURE_WINDOW_MS) {
    firstFailureAt = now;
    transientFailures = 0;
  }
  transientFailures += 1;
  emitAuthDebugEvent("get_user_transient_failure", {
    error,
    count: transientFailures,
    threshold: AUTH_FAILURE_THRESHOLD,
  });
}

export function shouldRedirectToLogin(): boolean {
  if (refreshInFlight || uxState === "refreshing_session") {
    emitAuthDebugEvent("redirect_to_login_blocked_due_refresh");
    return false;
  }
  if (uxState === "authenticated") return false;
  if (transientFailures > 0 && transientFailures < AUTH_FAILURE_THRESHOLD) {
    emitAuthDebugEvent("redirect_to_login_blocked_due_refresh", {
      reason: "transient_failures",
      count: transientFailures,
    });
    return false;
  }
  return uxState === "unauthenticated_confirmed";
}

export function confirmUnauthenticated() {
  transientFailures = 0;
  setUxState("unauthenticated_confirmed");
  emitAuthDebugEvent("unauthenticated_confirmed");
}

export function confirmAuthenticated() {
  refreshInFlight = false;
  transientFailures = 0;
  setUxState("authenticated");
}

export function markRedirectToNextAfterValidSession(next: string) {
  emitAuthDebugEvent("redirect_to_next_after_valid_session", { next });
}
