import { classifyUrlHostname } from "@/lib/network/safe-fetch";
import { DREAMOS_SUPABASE_PROJECT_REF, DREAMOS_SUPABASE_URL } from "@/lib/supabase/project-ref";

const EXPECTED_PROJECT_REF = DREAMOS_SUPABASE_PROJECT_REF;
const DEFAULT_PROJECT_URL = DREAMOS_SUPABASE_URL;

export type SupabaseEnvValidation = {
  ok: boolean;
  hostname: string | null;
  hostBucket: string;
  warnings: string[];
  errors: string[];
};

let validatedOnce = false;

/**
 * Validate NEXT_PUBLIC_SUPABASE_URL at server boot — never logs keys.
 */
export function validateSupabaseEnv(): SupabaseEnvValidation {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!raw) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is unset");
    return { ok: false, hostname: null, hostBucket: "unknown", warnings, errors };
  }

  let hostname: string | null = null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must use https");
    }
    hostname = u.hostname;
  } catch {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
    return { ok: false, hostname: null, hostBucket: "unknown", warnings, errors };
  }

  const hostBucket = classifyUrlHostname(hostname ?? "");

  if (hostBucket === "dreamos86.com") {
    errors.push(
      "NEXT_PUBLIC_SUPABASE_URL must not be the app domain (dreamos86.com). Use your Supabase project URL.",
    );
  }

  if (hostname === "auth.dreamos86.com") {
    if (process.env.NODE_ENV !== "production") {
      warnings.push(
        `Custom auth domain is configured for local dev. If SSL is not active, use ${DEFAULT_PROJECT_URL} instead.`,
      );
    }
  } else if (hostBucket === "supabase.co") {
    const ref = hostname?.split(".")[0];
    if (ref && ref !== EXPECTED_PROJECT_REF && process.env.NODE_ENV === "development") {
      warnings.push(
        `Supabase project ref "${ref}" differs from expected "${EXPECTED_PROJECT_REF}" — confirm this is intentional.`,
      );
    }
  } else if (hostBucket === "unknown") {
    warnings.push(`Unrecognized Supabase host "${hostname}" — expected *.supabase.co or verified custom auth domain.`);
  }

  const customAuthEnabled = process.env.DREAMOS_USE_CUSTOM_AUTH_DOMAIN === "1";
  if (hostname !== "auth.dreamos86.com" && !hostname?.endsWith(".supabase.co") && !customAuthEnabled) {
    warnings.push("Use the default Supabase project URL unless DREAMOS_USE_CUSTOM_AUTH_DOMAIN=1 and SSL is verified.");
  }

  return {
    ok: errors.length === 0,
    hostname,
    hostBucket,
    warnings,
    errors,
  };
}

/** Log validation once on server boot (development). */
export function logSupabaseEnvBoot(): void {
  if (validatedOnce) return;
  validatedOnce = true;
  if (process.env.NODE_ENV === "production") return;

  const v = validateSupabaseEnv();
  const anonPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  console.info("[DreamOS86][supabase-env]", {
    ok: v.ok,
    hostname: v.hostname,
    hostBucket: v.hostBucket,
    anonKeyConfigured: anonPresent,
    warnings: v.warnings,
    errors: v.errors,
  });
}
