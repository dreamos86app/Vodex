import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { callProviderStructured, parseJsonFromModel } from "@/lib/ai/provider-call";
import { slugifyAppName } from "@/lib/creation/parse-builder-metadata";
import { cleanAppName, stripMarkdownNoise } from "@/lib/projects/clean-app-name";

export type AppNameResult = {
  appName: string;
  slug: string;
  shortDescription: string;
  namingConfidence: number;
  source: "build_intent" | "fallback";
};

const BAD_NAME_RE =
  /^(my app|dashboard|saas app|untitled|new app|new build|app|application|dream app|viteapp|nextcrm|reactbuilder|platform|builder)$/i;
const KEYWORD_SPAM_RE =
  /\b(with|customizable|meditation|management|inventory)\b/i;
const QUESTION_RE = /^(how|what|which|why|when|where|should|can|do|does|is|are)\b/i;
const BUILD_VERB_RE = /^(build|create|make|develop|design)\s+(me\s+)?(a|an|the)\s+/i;

const CATEGORY_FALLBACKS: Record<string, string> = {
  restaurant: "FoodFlow",
  inventory: "FoodFlow",
  crm: "ClientFlow",
  ecommerce: "ShopPilot",
  booking: "SlotNest",
  finance: "Ledgerly",
  productivity: "FlowDesk",
};

function detectCategory(intent: string): string {
  const lower = intent.toLowerCase();
  if (/restaurant|food|inventory|kitchen|pantry/.test(lower)) return "restaurant";
  if (/crm|customer|client|sales|dentist|clinic/.test(lower)) return "crm";
  if (/shop|store|e-?commerce|product|cart/.test(lower)) return "ecommerce";
  if (/book|schedul|appointment|calendar|slot/.test(lower)) return "booking";
  if (/finance|ledger|account|budget|invoice/.test(lower)) return "finance";
  return "productivity";
}

function fallbackName(intent: string): string {
  return CATEGORY_FALLBACKS[detectCategory(intent)] ?? "FlowDesk";
}

function normalizeBuildIntent(raw: string): string {
  return raw.replace(BUILD_VERB_RE, "").replace(/\?+$/, "").replace(/\s+/g, " ").trim();
}

function isValidAppName(name: string, intent: string): boolean {
  const trimmed = cleanAppName(stripMarkdownNoise(name), intent);
  if (!trimmed || trimmed.length < 3 || trimmed.length > 24) return false;
  if (BAD_NAME_RE.test(trimmed)) return false;
  if (QUESTION_RE.test(trimmed)) return false;
  if (KEYWORD_SPAM_RE.test(trimmed)) return false;
  if (/react|next|vite|typescript|javascript|tailwind/i.test(trimmed)) return false;
  if (/\b(app|platform|dashboard|builder)\b/i.test(trimmed)) return false;
  const intentNorm = intent.trim().toLowerCase();
  if (intentNorm.length > 12 && intentNorm.includes(trimmed.toLowerCase())) return false;
  return true;
}

async function ensureUniqueSlug(
  writer: SupabaseClient<Database> | undefined,
  baseSlug: string,
  projectId?: string,
): Promise<string> {
  if (!writer) return baseSlug;
  let slug = baseSlug.slice(0, 48);
  for (let i = 0; i < 5; i++) {
    let query = writer.from("projects").select("id").eq("slug", slug).limit(1);
    if (projectId) query = query.neq("id", projectId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug.slice(0, 40)}-${i === 0 ? "app" : String(i + 1)}`.slice(0, 48);
  }
  return slug;
}

export async function generateAppName(input: {
  buildIntent: string;
  planSummary?: string;
  writer?: SupabaseClient<Database>;
  userId: string;
  userEmail?: string | null;
  operationId: string;
  projectId?: string;
  userSelectedModelId?: string | null;
}): Promise<AppNameResult> {
  const intent = normalizeBuildIntent(input.buildIntent);
  const fallback = fallbackName(intent);

  if (!intent || intent.length < 8 || QUESTION_RE.test(intent)) {
    return {
      appName: fallback,
      slug: await ensureUniqueSlug(input.writer, slugifyAppName(fallback), input.projectId),
      shortDescription: intent.slice(0, 240),
      namingConfidence: 0.3,
      source: "fallback",
    };
  }

  try {
    const res = await callProviderStructured({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: `${input.operationId}:name`,
      operationType: "app_identity",
      system: "You generate brandable app names. Output strict JSON only.",
      prompt: [
        "Generate a short brandable app name for this real app build.",
        'Return JSON: {"appName":"StockBite","shortDescription":"Restaurant inventory management","namingConfidence":0.92}',
        "",
        "Rules:",
        "- Single brandable compound word (3-18 chars), like Zenora, Lumis, FlowDesk, Velora, Kairo",
        "- Easy to pronounce, memorable, YC-startup quality",
        "- Match niche and vibe — never copy raw prompt words",
        "- Never use: App, Platform, Dashboard, Builder, With, Management",
        "- No generic names (My App, Dashboard, SaaS App)",
        "- No question text, no framework names",
        "",
        `Build intent:\n${intent}`,
        input.planSummary ? `\nPlan summary:\n${input.planSummary.slice(0, 800)}` : "",
      ].join("\n"),
      userSelectedModelId: input.userSelectedModelId,
    });

    const parsed = parseJsonFromModel<{
      appName?: string;
      shortDescription?: string;
      namingConfidence?: number;
    }>(res.text);
    const candidate = parsed?.appName?.trim() ?? "";
    if (isValidAppName(candidate, intent)) {
      const appName = cleanAppName(stripMarkdownNoise(candidate), intent);
      const slug = await ensureUniqueSlug(input.writer, slugifyAppName(appName), input.projectId);
      return {
        appName,
        slug,
        shortDescription: (parsed?.shortDescription ?? intent).trim().slice(0, 240),
        namingConfidence: Math.min(1, Math.max(0, parsed?.namingConfidence ?? 0.85)),
        source: "build_intent",
      };
    }
  } catch {
    /* fallback below */
  }

  const appName = fallback;
  return {
    appName,
    slug: await ensureUniqueSlug(input.writer, slugifyAppName(appName), input.projectId),
    shortDescription: intent.slice(0, 240),
    namingConfidence: 0.4,
    source: "fallback",
  };
}
