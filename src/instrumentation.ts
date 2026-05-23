/**
 * Called once when the Next.js server starts, before any requests are handled.
 */
import { logAppOriginBoot } from "@/lib/url/app-origin";
import { logSupabaseEnvBoot } from "@/lib/supabase/validate-supabase-env";

export function register() {
  if (process.env.NODE_ENV === "development") {
    // Windows dev: Node must use the OS trust store for Supabase CDN TLS (never disable verification).
    if (!process.env.NODE_USE_SYSTEM_CA) {
      process.env.NODE_USE_SYSTEM_CA = "1";
    }
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      console.warn(
        "[dreamos] NODE_TLS_REJECT_UNAUTHORIZED=0 is set — remove it. Use NODE_USE_SYSTEM_CA=1 instead.",
      );
    }
    logAppOriginBoot();
    logSupabaseEnvBoot();
  }
}
