import { createSupabaseAdmin } from "@/lib/supabase/admin";

const PROVIDER_KEY_MAP: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
  resend: ["RESEND_API_KEY"],
  stripe: ["STRIPE_SECRET_KEY"],
};

const LLM_ACTION_PREFIX = /^(llm_|ai_agent|ai_workflow)/i;

/** When user configured their own provider key, Vodex does not charge Action Credits for that provider's runtime. */
export async function shouldSkipActionCreditsForOwnProvider(args: {
  projectId?: string | null;
  actionType: string;
  provider?: string | null;
}): Promise<boolean> {
  if (!args.projectId) return false;
  const action = args.actionType;
  if (!LLM_ACTION_PREFIX.test(action) && action !== "email_send_notification" && action !== "email_send_transactional") {
    return false;
  }

  const provider =
    args.provider ??
    (action.includes("email") ? "resend" : action.includes("anthropic") ? "anthropic" : action.includes("gemini") ? "gemini" : "openai");

  const keys = PROVIDER_KEY_MAP[provider] ?? PROVIDER_KEY_MAP.openai;
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("project_secrets")
    .select("key_name")
    .eq("project_id", args.projectId)
    .in("key_name", keys);

  return (data ?? []).length > 0;
}
