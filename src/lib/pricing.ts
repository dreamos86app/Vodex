/**
 * Vodex — Pricing Architecture
 *
 * User-facing: 10 credits = $1 revenue (see @/lib/billing/pricing-config.ts).
 * Provider cost uses a separate internal ledger (30 internal credits = $1 cost).
 */
import {
  USER_CREDITS_PER_USD,
  USER_CREDIT_FLOORS,
} from "@/lib/billing/pricing-config";

export { USER_CREDITS_PER_USD, USER_CREDIT_FLOORS };

/** USD price for a credit package */
export function usdForCreditPackage(credits: number): number {
  return credits / USER_CREDITS_PER_USD;
}

/** Display helper: $5 → 50 credits */
export const CREDIT_PACKAGE_EXAMPLES = [
  { usd: 5, credits: 5 * USER_CREDITS_PER_USD },
  { usd: 10, credits: 10 * USER_CREDITS_PER_USD },
  { usd: 25, credits: 25 * USER_CREDITS_PER_USD },
  { usd: 50, credits: 50 * USER_CREDITS_PER_USD },
] as const;

export const BUILD_CREDIT_HINTS = {
  simple: `Simple app: from ${USER_CREDIT_FLOORS.build_simple} credits`,
  standard: `Standard app: from ${USER_CREDIT_FLOORS.build_medium} credits`,
  advanced: `Advanced app: from ${USER_CREDIT_FLOORS.build_hard} credits`,
  refundNote: "Unused reserved credits are returned",
} as const;

// ─── Plan IDs ─────────────────────────────────────────────────────────────────

export type PlanId =
  | "starter"
  | "pro"
  | "studio"
  | "infinity_i"
  | "infinity_ii"
  | "infinity_iii"
  | "infinity_ultra"
  | "infinity_elite";

export type PlanTier = "entry" | "creator" | "infinity";
export type BillingInterval = "monthly" | "yearly";

// ─── Plan Definition ──────────────────────────────────────────────────────────

export interface Plan {
  id: PlanId;
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyPrice: number;
  /** Monthly equivalent when billed annually */
  yearlyMonthlyPrice: number;
  highlight?: boolean;
  badge?: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  isInfinity?: boolean;
  limits: PlanLimits;
  features: string[];
  /** Features explicitly locked (shown with upgrade prompt) */
  locked?: string[];
}

export interface PlanLimits {
  /** Credits per billing month */
  credits: number;
  projects: number | "unlimited";
  storage: string;
  /** Seat count */
  collaborators: number | "unlimited";
  deployments: number | "unlimited";
  /** Model tier access */
  modelTier: "standard" | "premium" | "ultra" | "all";
  mediaGen: boolean;
  /** Max images per month */
  mediaCreditsPerMonth: number;
  customDomains: number | "unlimited";
  api: boolean;
  prioritySupport: boolean;
  sla: boolean;
  whiteLabel: boolean;
  dedicatedInfra: boolean;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export const plans: Plan[] = [
  {
    id: "starter",
    tier: "entry",
    name: "Starter",
    tagline: "Step into the world of AI-native creation.",
    monthlyPrice: 19.99,
    yearlyMonthlyPrice: 16.99,
    accentColor: "#6b7280",
    gradientFrom: "from-slate-500/12",
    gradientTo: "to-gray-500/8",
    limits: {
      credits: 200,
      projects: 3,
      storage: "1 GB",
      collaborators: 1,
      deployments: 5,
      modelTier: "standard",
      mediaGen: false,
      mediaCreditsPerMonth: 0,
      customDomains: 0,
      api: false,
      prioritySupport: false,
      sla: false,
      whiteLabel: false,
      dedicatedInfra: false,
    },
    features: [
      "200 AI credits / month",
      "3 active projects",
      "1 GB asset storage",
      "5 deployments / month",
      "Standard AI models",
      "Community templates",
      "Live preview",
    ],
    locked: [
      "Media generation",
      "Premium models",
      "Custom domains",
      "API access",
      "Collaborators",
    ],
  },
  {
    id: "pro",
    tier: "entry",
    name: "Pro",
    tagline: "The sweet spot for serious builders.",
    monthlyPrice: 49.99,
    yearlyMonthlyPrice: 41.99,
    highlight: true,
    badge: "Most Popular",
    accentColor: "#1e6bff",
    gradientFrom: "from-blue-500/14",
    gradientTo: "to-indigo-500/10",
    limits: {
      credits: 500,
      projects: 15,
      storage: "10 GB",
      collaborators: 3,
      deployments: "unlimited",
      modelTier: "premium",
      mediaGen: true,
      mediaCreditsPerMonth: 50,
      customDomains: 2,
      api: true,
      prioritySupport: false,
      sla: false,
      whiteLabel: false,
      dedicatedInfra: false,
    },
    features: [
      "500 AI credits / month",
      "15 projects",
      "10 GB storage",
      "Unlimited deployments",
      "Premium AI models",
      "All templates",
      "3 collaborators",
      "50 media generations / mo",
      "2 custom domains",
      "API access",
      "Export code",
    ],
    locked: ["Priority support", "White-label", "SLA", "Dedicated infra"],
  },
  {
    id: "studio",
    tier: "creator",
    name: "Studio",
    tagline: "Unlock the full creative arsenal.",
    monthlyPrice: 99,
    yearlyMonthlyPrice: 82.99,
    badge: "Best Value",
    accentColor: "#7c3aed",
    gradientFrom: "from-violet-500/14",
    gradientTo: "to-purple-500/10",
    limits: {
      credits: 2500,
      projects: "unlimited",
      storage: "50 GB",
      collaborators: 10,
      deployments: "unlimited",
      modelTier: "ultra",
      mediaGen: true,
      mediaCreditsPerMonth: 200,
      customDomains: "unlimited",
      api: true,
      prioritySupport: true,
      sla: false,
      whiteLabel: false,
      dedicatedInfra: false,
    },
    features: [
      "2,500 AI credits / month",
      "Unlimited projects",
      "50 GB storage",
      "All AI models incl. Opus & GPT-4.5",
      "10 collaborators",
      "200 media generations / mo",
      "Unlimited custom domains",
      "Full API access",
      "Priority support",
      "Advanced analytics",
      "White-label previews",
    ],
    locked: ["SLA guarantee", "Dedicated infra"],
  },
  {
    id: "infinity_i",
    tier: "infinity",
    name: "Infinity I",
    tagline: "Practically limitless for power creators.",
    monthlyPrice: 149,
    yearlyMonthlyPrice: 124.99,
    isInfinity: true,
    accentColor: "#2563eb",
    gradientFrom: "from-blue-600/20",
    gradientTo: "to-indigo-600/15",
    limits: {
      credits: 6000,
      projects: "unlimited",
      storage: "100 GB",
      collaborators: 25,
      deployments: "unlimited",
      modelTier: "all",
      mediaGen: true,
      mediaCreditsPerMonth: 500,
      customDomains: "unlimited",
      api: true,
      prioritySupport: true,
      sla: false,
      whiteLabel: true,
      dedicatedInfra: false,
    },
    features: [
      "6,000 AI credits / month",
      "Unlimited projects + storage 100 GB",
      "500 media generations / mo",
      "25 collaborators",
      "All models + priority routing",
      "White-label exports",
      "Priority support",
      "Advanced usage analytics",
    ],
  },
  {
    id: "infinity_ii",
    tier: "infinity",
    name: "Infinity II",
    tagline: "High-volume creation without friction.",
    monthlyPrice: 249,
    yearlyMonthlyPrice: 207.99,
    isInfinity: true,
    accentColor: "#4f46e5",
    gradientFrom: "from-indigo-600/20",
    gradientTo: "to-violet-600/15",
    limits: {
      credits: 15000,
      projects: "unlimited",
      storage: "250 GB",
      collaborators: 50,
      deployments: "unlimited",
      modelTier: "all",
      mediaGen: true,
      mediaCreditsPerMonth: 1500,
      customDomains: "unlimited",
      api: true,
      prioritySupport: true,
      sla: true,
      whiteLabel: true,
      dedicatedInfra: false,
    },
    features: [
      "15,000 AI credits / month",
      "250 GB storage",
      "1,500 media generations / mo",
      "50 collaborators",
      "SLA 99.9% uptime guarantee",
      "White-label + custom branding",
    ],
  },
  {
    id: "infinity_iii",
    tier: "infinity",
    name: "Infinity III",
    tagline: "Agency-scale output, every single day.",
    monthlyPrice: 499,
    yearlyMonthlyPrice: 414.99,
    isInfinity: true,
    accentColor: "#7c3aed",
    gradientFrom: "from-violet-600/22",
    gradientTo: "to-purple-700/16",
    limits: {
      credits: 40000,
      projects: "unlimited",
      storage: "500 GB",
      collaborators: 100,
      deployments: "unlimited",
      modelTier: "all",
      mediaGen: true,
      mediaCreditsPerMonth: 4000,
      customDomains: "unlimited",
      api: true,
      prioritySupport: true,
      sla: true,
      whiteLabel: true,
      dedicatedInfra: false,
    },
    features: [
      "40,000 AI credits / month",
      "500 GB storage",
      "4,000 media generations / mo",
      "100 collaborators",
      "Dedicated account manager",
      "Custom model routing",
    ],
  },
  {
    id: "infinity_ultra",
    tier: "infinity",
    name: "Infinity Ultra",
    tagline: "For startups building at warp speed.",
    monthlyPrice: 999,
    yearlyMonthlyPrice: 832.99,
    isInfinity: true,
    badge: "Scale",
    accentColor: "#9333ea",
    gradientFrom: "from-purple-700/24",
    gradientTo: "to-fuchsia-700/18",
    limits: {
      credits: 100000,
      projects: "unlimited",
      storage: "2000 GB",
      collaborators: "unlimited",
      deployments: "unlimited",
      modelTier: "all",
      mediaGen: true,
      mediaCreditsPerMonth: 10000,
      customDomains: "unlimited",
      api: true,
      prioritySupport: true,
      sla: true,
      whiteLabel: true,
      dedicatedInfra: true,
    },
    features: [
      "100,000 AI credits / month",
      "2 TB storage",
      "10,000 media generations / mo",
      "Unlimited collaborators",
      "Dedicated infrastructure",
      "SSO / SAML",
      "Audit logs",
    ],
  },
  {
    id: "infinity_elite",
    tier: "infinity",
    name: "Infinity Elite",
    tagline: "Enterprise AI creation infrastructure.",
    monthlyPrice: 1999,
    yearlyMonthlyPrice: 1665.99,
    isInfinity: true,
    badge: "Elite",
    accentColor: "#ca8a04",
    gradientFrom: "from-amber-600/20",
    gradientTo: "to-yellow-700/12",
    limits: {
      credits: 300000,
      projects: "unlimited",
      storage: "10000 GB",
      collaborators: "unlimited",
      deployments: "unlimited",
      modelTier: "all",
      mediaGen: true,
      mediaCreditsPerMonth: 30000,
      customDomains: "unlimited",
      api: true,
      prioritySupport: true,
      sla: true,
      whiteLabel: true,
      dedicatedInfra: true,
    },
    features: [
      "300,000 AI credits / month",
      "10 TB storage",
      "30,000 media generations / mo",
      "Unlimited everything",
      "Custom AI model fine-tuning",
      "99.99% SLA + dedicated CSM",
      "Custom contract & invoicing",
    ],
  },
];

// ─── Credit Cost System ────────────────────────────────────────────────────────

/**
 * Internal credit cost table.
 * These are what operations cost in user-facing credits.
 * Actual API costs are ~10-20× lower (our margin).
 */
export interface CreditOperation {
  id: string;
  label: string;
  description: string;
  category: "generation" | "media" | "edit" | "deploy" | "analysis";
  baseCost: number;
  /** Applies when using premium model tier */
  premiumMultiplier: number;
  /** Applies when using ultra model tier */
  ultraMultiplier: number;
}

export const creditOperations: CreditOperation[] = [
  // App Generation
  {
    id: "app_simple",
    label: "Simple App Generation",
    description: "Landing page, form, or single-screen utility",
    category: "generation",
    baseCost: 9,
    premiumMultiplier: 1.8,
    ultraMultiplier: 3.5,
  },
  {
    id: "app_standard",
    label: "Standard App Generation",
    description: "Multi-page app with auth, data, and routing",
    category: "generation",
    baseCost: 22,
    premiumMultiplier: 1.8,
    ultraMultiplier: 3.5,
  },
  {
    id: "app_complex",
    label: "Complex App Generation",
    description: "Full-stack app with integrations, AI, and advanced features",
    category: "generation",
    baseCost: 50,
    premiumMultiplier: 2.0,
    ultraMultiplier: 4.0,
  },
  // Edits
  {
    id: "edit_component",
    label: "Component Edit",
    description: "Modify a single component or section",
    category: "edit",
    baseCost: 2,
    premiumMultiplier: 1.5,
    ultraMultiplier: 2.5,
  },
  {
    id: "edit_page",
    label: "Page Redesign",
    description: "Regenerate or significantly alter a full page",
    category: "edit",
    baseCost: 10,
    premiumMultiplier: 1.8,
    ultraMultiplier: 3.0,
  },
  // Media Generation (expensive — intentionally)
  {
    id: "media_image_standard",
    label: "Image Generation",
    description: "Standard quality image (1024×1024)",
    category: "media",
    baseCost: 15,
    premiumMultiplier: 2.0,
    ultraMultiplier: 3.5,
  },
  {
    id: "media_image_hd",
    label: "HD Image Generation",
    description: "High-definition image (2048×2048)",
    category: "media",
    baseCost: 40,
    premiumMultiplier: 2.0,
    ultraMultiplier: 3.5,
  },
  {
    id: "media_image_batch",
    label: "Image Batch (×4)",
    description: "Four variations in a single generation",
    category: "media",
    baseCost: 50,
    premiumMultiplier: 2.0,
    ultraMultiplier: 3.5,
  },
  {
    id: "media_icon_set",
    label: "App Icon Set",
    description: "Full icon set across all required sizes",
    category: "media",
    baseCost: 40,
    premiumMultiplier: 1.8,
    ultraMultiplier: 3.0,
  },
  // Analysis & AI Chat
  {
    id: "analysis_code",
    label: "Code Analysis",
    description: "Review, explain, or refactor code sections",
    category: "analysis",
    baseCost: 3,
    premiumMultiplier: 1.5,
    ultraMultiplier: 2.5,
  },
  {
    id: "chat_message",
    label: "AI Chat Message",
    description: "Single conversation turn in AI Chat",
    category: "analysis",
    baseCost: 1,
    premiumMultiplier: 1.5,
    ultraMultiplier: 2.5,
  },
];

// ─── Model Tier Credit Multipliers ────────────────────────────────────────────

export const modelCreditMultipliers: Record<string, number> = {
  // Standard tier (~1×)
  "claude-haiku": 1.0,
  "gpt-4o-mini": 1.0,
  "deepseek-v3": 1.0,
  // Premium tier (~1.8×)
  "claude-sonnet": 1.8,
  "gpt-4o": 1.8,
  "gemini-pro": 1.6,
  "grok-2": 1.5,
  // Ultra tier (~3.5×)
  "claude-opus": 3.5,
  "gpt-4-5": 4.0,
  "gemini-ultra": 3.0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Analytics dashboard — Starter and above. */
export function planIncludesAnalytics(planId: PlanId | string | null | undefined): boolean {
  return planId != null && planId !== "free";
}

/** ZIP import — Pro and above. */
export function planIncludesZipImport(planId: PlanId | string | null | undefined): boolean {
  return planId === "pro" || planId === "infinity" || (typeof planId === "string" && planId.startsWith("infinity"));
}

export function getPlanById(id: PlanId): Plan {
  return plans.find((p) => p.id === id)!;
}

export function getYearlySavings(plan: Plan): number {
  return Math.round(
    (plan.monthlyPrice - plan.yearlyMonthlyPrice) * 12,
  );
}

export function getYearlySavingsPct(plan: Plan): number {
  return Math.round(
    ((plan.monthlyPrice - plan.yearlyMonthlyPrice) / plan.monthlyPrice) * 100,
  );
}

export function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

/** Throttle tier: what fraction of the plan limit triggers a soft warning */
export const THROTTLE_THRESHOLDS = {
  warning: 0.75,  // 75% → show warning
  critical: 0.90, // 90% → show upgrade nudge
  hard: 1.0,      // 100% → block generation
} as const;
