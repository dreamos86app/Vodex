/**
 * Product intelligence layer — turns prompts into believable startup MVP briefs.
 * Runs after shallow/domain feature expansion, before intake/planning.
 */
import type { AppArchetypeId } from "@/lib/build/app-archetype-classifier";
import { classifyAppArchetype } from "@/lib/build/app-archetype-classifier";

export type ProductIntelligenceBrief = {
  archetypeId: AppArchetypeId;
  targetUser: string;
  businessModel: string;
  workflows: string[];
  keyMetrics: string[];
  coreScreens: string[];
  primaryActions: string[];
  uxStyle: string;
  mockDataGuidance: string;
  headline: string;
};

export type ProductIntelligenceResult = {
  brief: ProductIntelligenceBrief;
  executionPrompt: string;
  expanded: boolean;
};

const LAUNCH_PAD_RE =
  /launch\s*pad|product launch|waitlist|early[- ]?bird|affiliate|launch day analytics|pre[- ]?launch|go[- ]?to[- ]?market/i;

function detectLaunchPad(prompt: string): boolean {
  return LAUNCH_PAD_RE.test(prompt);
}

function launchPadBrief(): ProductIntelligenceBrief {
  return {
    archetypeId: "product_launch_pad",
    targetUser: "Founders and growth teams launching digital products",
    businessModel: "Waitlist → early-bird checkout → affiliate-driven growth → launch analytics",
    workflows: [
      "Create launch campaign with countdown and goals",
      "Capture waitlist signups with funnel stages",
      "Run early-bird checkout with limited slots",
      "Track affiliates and referral revenue",
      "Monitor launch-day traffic, conversion, and revenue",
      "Send email blasts to segments",
      "Edit product positioning and landing sections",
    ],
    keyMetrics: [
      "Total signups",
      "Conversion rate",
      "Launch countdown",
      "Affiliate revenue",
      "Traffic vs sales trend",
      "Campaign performance",
      "Waitlist funnel drop-off",
    ],
    coreScreens: [
      "Overview dashboard (KPI grid + charts + recent activity)",
      "Launch campaigns",
      "Waitlist management",
      "Affiliate / referral program",
      "Orders & revenue",
      "Analytics (traffic + sales graphs)",
      "Checkout & pricing settings",
      "Product editor",
      "Landing page builder",
      "Email blast center",
    ],
    primaryActions: [
      "Create campaign",
      "Export waitlist",
      "Invite affiliate",
      "View funnel",
      "Send blast",
      "Preview landing",
    ],
    uxStyle:
      "Premium startup launch aesthetic — indigo/violet gradients, bold KPI cards, dual charts, countdown hero, energetic CTAs, dense but breathable layout",
    mockDataGuidance:
      "Populate every table and chart with realistic names, numbers, dates, and percentages (12+ waitlist rows, 6 affiliates, 30-day traffic/sales series, 4 campaigns)",
    headline: "Designing a digital product launch pad MVP",
  };
}

function genericBrief(archetypeId: AppArchetypeId, prompt: string): ProductIntelligenceBrief {
  const archetype = classifyAppArchetype(prompt);
  return {
    archetypeId,
    targetUser: `Primary users of this ${archetype.label.toLowerCase()}`,
    businessModel: "Subscription or transaction SaaS with self-serve dashboard",
    workflows: [
      "Onboard new user with guided checklist",
      "Review KPI dashboard daily",
      "Manage core records in table views",
      "Filter, search, and export data",
      "Configure settings and team access",
    ],
    keyMetrics: ["Active users", "Conversion", "Revenue or usage", "Growth trend", "Tasks due"],
    coreScreens: archetype.coreRoutes.map((r) => r.replace(/^\//, "") || "dashboard"),
    primaryActions: ["Create", "Filter", "Export", "View details", "Invite teammate"],
    uxStyle: `${archetype.visualTone} — modern SaaS spacing, gradient accents, iconography, clear hierarchy`,
    mockDataGuidance:
      "No empty tables — use realistic sample rows (8–15), varied statuses, currency, dates, and chart series",
    headline: `Planning ${archetype.label} product experience`,
  };
}

function formatBriefBlock(brief: ProductIntelligenceBrief): string {
  return [
    "PRODUCT INTELLIGENCE (implement literally — this is the product spec):",
    `Target user: ${brief.targetUser}`,
    `Business model: ${brief.businessModel}`,
    "",
    "Core workflows:",
    ...brief.workflows.map((w) => `- ${w}`),
    "",
    "Dashboard KPIs & metrics:",
    ...brief.keyMetrics.map((m) => `- ${m}`),
    "",
    "Required screens/routes:",
    ...brief.coreScreens.map((s) => `- ${s}`),
    "",
    "Primary actions (visible buttons/links):",
    ...brief.primaryActions.map((a) => `- ${a}`),
    "",
    `UX style: ${brief.uxStyle}`,
    `Mock data: ${brief.mockDataGuidance}`,
    "",
    "Dashboard rules (hard):",
    "- Minimum 4 KPI/stat cards with numbers",
    "- At least 1 chart (line, bar, or area) with realistic series data",
    "- At least 2 distinct sections (e.g. recent signups + top affiliates)",
    "- At least 2 primary CTAs above the fold",
    "- No welcome-only hero; no empty whitespace shell",
    "- Onboarding checklist or getting-started strip when appropriate",
  ].join("\n");
}

/** Enrich execution prompt with product-thinking brief. */
export function expandProductIntelligence(input: {
  userPrompt: string;
  executionPrompt: string;
  archetypeId: AppArchetypeId;
}): ProductIntelligenceResult {
  const prompt = input.userPrompt.trim();
  let brief: ProductIntelligenceBrief;

  if (detectLaunchPad(prompt)) {
    brief = launchPadBrief();
  } else {
    brief = genericBrief(input.archetypeId, prompt);
  }

  const block = formatBriefBlock(brief);
  const executionPrompt = [input.executionPrompt, "", block].join("\n");

  return {
    brief,
    executionPrompt,
    expanded: true,
  };
}
