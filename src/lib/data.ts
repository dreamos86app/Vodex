/** DreamOS86 — comprehensive mock data and static records */

// ─── Plan types/data — re-exported from pricing architecture ─────────────────
export type {
  PlanId,
  BillingInterval,
  Plan,
  PlanLimits,
  PlanTier,
  CreditOperation,
} from "@/lib/pricing";
export {
  plans,
  creditOperations,
  modelCreditMultipliers,
  getPlanById,
  getYearlySavings,
  getYearlySavingsPct,
  formatCredits,
  THROTTLE_THRESHOLDS,
} from "@/lib/pricing";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  gradient: string;
  accent: string;
  tags: string[];
  complexity: "simple" | "medium" | "advanced";
  popular?: boolean;
  new?: boolean;
  prompt: string;
}

export type TemplateCategory =
  | "saas"
  | "ai"
  | "marketplace"
  | "social"
  | "finance"
  | "productivity"
  | "portfolio"
  | "mobile"
  | "community"
  | "enterprise";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  providerSlug: string;
  description: string;
  contextWindow: string;
  speed: "fast" | "medium" | "slow";
  quality: "standard" | "premium" | "ultra";
  creditsPerGeneration: number;
  available: boolean;
  comingSoon?: boolean;
  new?: boolean;
  badge?: string;
  color: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  connected: boolean;
  comingSoon?: boolean;
}

export interface Notification {
  id: string;
  type: "deploy" | "build" | "invite" | "credit" | "system" | "ai";
  title: string;
  body: string;
  timeLabel: string;
  read: boolean;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  title: string;
  description: string;
  highlights: string[];
}

// ─── Plans — defined in src/lib/pricing.ts, re-exported above ─────────────────

// ─── Templates ───────────────────────────────────────────────────────────────

export const templates: Template[] = [
  {
    id: "saas-landing",
    name: "SaaS Landing",
    description: "Convert visitors with a world-class product page.",
    category: "saas",
    gradient: "from-blue-500/20 via-indigo-500/10 to-violet-500/15",
    accent: "#4d8dff",
    tags: ["Landing", "Marketing", "Waitlist"],
    complexity: "medium",
    popular: true,
    prompt:
      "A premium SaaS landing page with hero, features, pricing, and waitlist signup",
  },
  {
    id: "ai-assistant",
    name: "AI Assistant",
    description: "Intelligent conversational AI with memory and context.",
    category: "ai",
    gradient: "from-violet-500/20 via-purple-500/10 to-pink-500/15",
    accent: "#a855f7",
    tags: ["Chat", "AI", "Assistant"],
    complexity: "advanced",
    popular: true,
    prompt: "A beautiful AI assistant app with streaming responses and memory",
  },
  {
    id: "marketplace",
    name: "Marketplace",
    description: "Buy and sell anything with a beautiful storefront.",
    category: "marketplace",
    gradient: "from-emerald-500/20 via-teal-500/10 to-cyan-500/15",
    accent: "#10b981",
    tags: ["Store", "Products", "Payments"],
    complexity: "advanced",
    prompt:
      "A two-sided marketplace with product listings, search, and checkout",
  },
  {
    id: "booking-app",
    name: "Booking App",
    description: "Schedule appointments with elegance and ease.",
    category: "saas",
    gradient: "from-sky-500/20 via-blue-500/10 to-indigo-500/15",
    accent: "#0ea5e9",
    tags: ["Calendar", "Scheduling", "Bookings"],
    complexity: "medium",
    prompt:
      "A booking and scheduling app with calendar, availability, and reminders",
  },
  {
    id: "social-platform",
    name: "Social Platform",
    description: "Build community around shared interests.",
    category: "social",
    gradient: "from-rose-500/20 via-pink-500/10 to-fuchsia-500/15",
    accent: "#f43f5e",
    tags: ["Social", "Feed", "Community"],
    complexity: "advanced",
    popular: true,
    prompt: "A social platform with profiles, feed, follows, and messaging",
  },
  {
    id: "finance-app",
    name: "Finance App",
    description: "Track expenses and understand your money.",
    category: "finance",
    gradient: "from-green-500/20 via-emerald-500/10 to-teal-500/15",
    accent: "#22c55e",
    tags: ["Finance", "Budget", "Analytics"],
    complexity: "medium",
    prompt:
      "A personal finance app with expense tracking, budgets, and charts",
  },
  {
    id: "productivity-workspace",
    name: "Productivity Workspace",
    description: "A focused space for deep work and flow.",
    category: "productivity",
    gradient: "from-amber-500/20 via-orange-500/10 to-yellow-500/15",
    accent: "#f59e0b",
    tags: ["Tasks", "Notes", "Workspace"],
    complexity: "advanced",
    prompt:
      "A productivity workspace with notes, tasks, kanban, and calendar",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Showcase your work with cinematic impact.",
    category: "portfolio",
    gradient: "from-slate-500/20 via-gray-500/10 to-zinc-500/15",
    accent: "#64748b",
    tags: ["Portfolio", "Creative", "Gallery"],
    complexity: "simple",
    prompt: "A stunning personal portfolio with projects, about, and contact",
  },
  {
    id: "team-wiki",
    name: "Team Wiki",
    description: "Collaborative knowledge base for your team.",
    category: "productivity",
    gradient: "from-blue-500/15 via-cyan-500/10 to-sky-500/15",
    accent: "#3b82f6",
    tags: ["Docs", "Wiki", "Collaboration"],
    complexity: "medium",
    prompt: "A team wiki with pages, search, comments, and permissions",
  },
  {
    id: "crm",
    name: "CRM",
    description: "Manage relationships that actually matter.",
    category: "enterprise",
    gradient: "from-indigo-500/20 via-blue-500/10 to-sky-500/15",
    accent: "#6366f1",
    tags: ["CRM", "Sales", "Contacts"],
    complexity: "advanced",
    prompt: "A CRM with contacts, deals pipeline, activities, and reports",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Visualize your data with clarity and depth.",
    category: "enterprise",
    gradient: "from-violet-500/15 via-indigo-500/10 to-blue-500/15",
    accent: "#8b5cf6",
    tags: ["Analytics", "Charts", "Metrics"],
    complexity: "medium",
    new: true,
    prompt: "A beautiful analytics dashboard with charts, KPIs, and filters",
  },
  {
    id: "ai-chat",
    name: "AI Chat",
    description: "Real-time streaming chat powered by multiple models.",
    category: "ai",
    gradient: "from-cyan-500/20 via-sky-500/10 to-blue-500/15",
    accent: "#06b6d4",
    tags: ["Chat", "AI", "Streaming"],
    complexity: "medium",
    new: true,
    prompt: "An AI chat application with multiple models and streaming responses",
  },
  {
    id: "community-platform",
    name: "Community Platform",
    description: "Forums, discussions, and shared knowledge.",
    category: "community",
    gradient: "from-orange-500/20 via-amber-500/10 to-yellow-500/15",
    accent: "#f97316",
    tags: ["Forum", "Community", "Discussions"],
    complexity: "advanced",
    prompt: "A community platform with forums, posts, votes, and moderation",
  },
  {
    id: "mobile-app",
    name: "Mobile App",
    description: "Ship to iOS and Android from a single codebase.",
    category: "mobile",
    gradient: "from-teal-500/20 via-cyan-500/10 to-sky-500/15",
    accent: "#14b8a6",
    tags: ["Mobile", "iOS", "Android"],
    complexity: "advanced",
    popular: true,
    prompt: "A cross-platform mobile app with navigation, auth, and data sync",
  },
];

// ─── AI Models ───────────────────────────────────────────────────────────────

export const aiModels: AIModel[] = [
  {
    id: "automatic",
    name: "Automatic",
    provider: "DreamOS86",
    providerSlug: "dreamos",
    description:
      "Automatically adjusts the model depending on your request to provide the best quality.",
    contextWindow: "—",
    speed: "fast",
    quality: "premium",
    creditsPerGeneration: 0,
    available: true,
    badge: "Recommended",
    color: "#6366f1",
  },
  // ─── Anthropic ───────────────────────────────────────────────────────────────
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    provider: "Anthropic",
    providerSlug: "anthropic",
    description: "Anthropic's most powerful model. Best for complex reasoning, nuanced writing, and deep code architecture.",
    contextWindow: "200K",
    speed: "slow",
    quality: "ultra",
    creditsPerGeneration: 25,
    available: true,
    badge: "Most Powerful",
    color: "#f97316",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    providerSlug: "anthropic",
    description: "Frontier reasoning and full-stack quality for demanding builds.",
    contextWindow: "200K",
    speed: "slow",
    quality: "ultra",
    creditsPerGeneration: 20,
    available: true,
    color: "#f97316",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    providerSlug: "anthropic",
    description: "Balanced intelligence and speed — strong default for manual selection.",
    contextWindow: "200K",
    speed: "medium",
    quality: "premium",
    creditsPerGeneration: 10,
    available: true,
    color: "#f97316",
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    providerSlug: "anthropic",
    description: "Ideal blend of speed and intelligence. Best for coding, analysis, and structured tasks.",
    contextWindow: "200K",
    speed: "medium",
    quality: "premium",
    creditsPerGeneration: 10,
    available: true,
    badge: "Recommended",
    color: "#f97316",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    providerSlug: "anthropic",
    description: "Fastest Anthropic model. Best for quick edits, simple questions, and high-volume tasks.",
    contextWindow: "200K",
    speed: "fast",
    quality: "standard",
    creditsPerGeneration: 2,
    available: true,
    color: "#f97316",
  },
  // ─── OpenAI ──────────────────────────────────────────────────────────────────
  {
    id: "gpt-5-5",
    name: "GPT-5.5",
    provider: "OpenAI",
    providerSlug: "openai",
    description: "OpenAI's frontier model. Best for deep reasoning, research synthesis, and complex multi-step tasks.",
    contextWindow: "256K",
    speed: "slow",
    quality: "ultra",
    creditsPerGeneration: 25,
    available: true,
    new: true,
    badge: "Latest",
    color: "#10a37f",
  },
  {
    id: "gpt-5-4",
    name: "GPT-5.4",
    provider: "OpenAI",
    providerSlug: "openai",
    description: "High-capability multimodal model with vision and structured output. Excellent for UI generation.",
    contextWindow: "256K",
    speed: "medium",
    quality: "ultra",
    creditsPerGeneration: 15,
    available: true,
    color: "#10a37f",
  },
  {
    id: "gpt-5-4-mini",
    name: "GPT-5.4 Mini",
    provider: "OpenAI",
    providerSlug: "openai",
    description: "Fast and cost-efficient. Best for everyday coding tasks, refactoring, and quick answers.",
    contextWindow: "128K",
    speed: "fast",
    quality: "standard",
    creditsPerGeneration: 2,
    available: true,
    color: "#10a37f",
  },
  // ─── Google ──────────────────────────────────────────────────────────────────
  {
    id: "gemini-2-5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    providerSlug: "google",
    description: "Large-context analysis and multimodal reasoning — used for repo-scale tasks.",
    contextWindow: "1M",
    speed: "medium",
    quality: "ultra",
    creditsPerGeneration: 8,
    available: true,
    color: "#4285f4",
  },
  {
    id: "gemini-3-1-pro",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    providerSlug: "google",
    description: "Google's flagship model. Best for large-context analysis, document understanding, and multimodal tasks.",
    contextWindow: "2M",
    speed: "medium",
    quality: "ultra",
    creditsPerGeneration: 15,
    available: true,
    badge: "2M Context",
    color: "#4285f4",
  },
  {
    id: "gemini-flash",
    name: "Gemini Flash",
    provider: "Google",
    providerSlug: "google",
    description: "Ultra-fast Google model. Best for rapid iteration, summaries, and lightweight tasks.",
    contextWindow: "1M",
    speed: "fast",
    quality: "standard",
    creditsPerGeneration: 1,
    available: true,
    color: "#4285f4",
  },
  // ─── xAI ─────────────────────────────────────────────────────────────────────
  {
    id: "grok-4",
    name: "Grok 4",
    provider: "xAI",
    providerSlug: "xai",
    description: "Real-time knowledge and strong reasoning. Best for research, analysis, and creative problem-solving.",
    contextWindow: "256K",
    speed: "medium",
    quality: "premium",
    creditsPerGeneration: 10,
    available: false,
    comingSoon: true,
    new: true,
    color: "#1d1f27",
  },
  // ─── Cursor / Composer ───────────────────────────────────────────────────────
  {
    id: "composer-latest",
    name: "Composer",
    provider: "Cursor",
    providerSlug: "cursor",
    description: "Cursor's custom coding model. Optimized for multi-file editing, refactoring, and code generation.",
    contextWindow: "128K",
    speed: "fast",
    quality: "premium",
    creditsPerGeneration: 5,
    available: true,
    badge: "Code-First",
    color: "#6b7280",
  },
];

// ─── Integrations ─────────────────────────────────────────────────────────────

export const integrations: Integration[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Sync projects, auto-deploy on push, version control.",
    category: "Version Control",
    logo: "github",
    connected: false,
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "One-click deployments with instant previews.",
    category: "Deployment",
    logo: "vercel",
    connected: false,
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept payments in your generated apps instantly.",
    category: "Payments",
    logo: "stripe",
    connected: false,
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Open source Firebase alternative with Postgres.",
    category: "Database",
    logo: "supabase",
    connected: false,
  },
  {
    id: "figma",
    name: "Figma",
    description: "Import designs and generate pixel-perfect code.",
    category: "Design",
    logo: "figma",
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get build notifications and updates in Slack.",
    category: "Communication",
    logo: "slack",
    connected: false,
  },
  {
    id: "linear",
    name: "Linear",
    description: "Sync issues and track project progress.",
    category: "Project Management",
    logo: "linear",
    connected: false,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Import Notion docs as app content source.",
    category: "Knowledge",
    logo: "notion",
    connected: false,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Edge deployments with global CDN.",
    category: "Deployment",
    logo: "cloudflare",
    connected: false,
    comingSoon: true,
  },
  {
    id: "resend",
    name: "Resend",
    description: "Transactional emails for your generated apps.",
    category: "Email",
    logo: "resend",
    connected: false,
  },
];

// ─── Notifications ────────────────────────────────────────────────────────────
// Notifications are loaded from the database via AppProvider + Supabase Realtime.
// This static array is intentionally empty — all notifications are real DB records.
export const notifications: Notification[] = [];

// ─── Changelog ────────────────────────────────────────────────────────────────

export const changelog: ChangelogEntry[] = [
  {
    id: "production-reliability-may-2026",
    version: "0.9.0",
    date: "May 23, 2026",
    type: "major",
    title: "Production reliability, credits, ZIP import, and workflow upgrades",
    description:
      "A polished upgrade for daily use: more reliable AI Chat, clearer credit balances, larger ZIP imports for real projects, and smoother Create and homepage workflows.",
    highlights: [
      "AI Chat conversations save, reload, and switch reliably for signed-in users",
      "Credit tracking is more reliable and easier to understand in your account menu",
      "Billing diagnostics and credit processing are more dependable for paid AI actions",
      "First create prompt is Build-only; Discuss and Edit unlock after an app exists",
      "AI Chat knows DreamOS86 product flows and answers in plain language",
      "Public homepage redesign with animated Build → Preview → Publish workflow",
      "DreamOS86 in numbers section restored on the marketing site",
      "ZIP import for existing projects with framework detection (up to 1,500 source files)",
      "Create App dashboard and blueprint/template improvements",
      "Faster navigation with clearer loading states",
      "Admin diagnostics improvements for platform owners",
      "Local development verify helpers for contributors",
    ],
  },
  {
    id: "chat-persistence",
    version: "0.8.0",
    date: "May 15, 2026",
    type: "major",
    title: "AI chat with Supabase persistence",
    description:
      "Assistant threads and messages are stored for signed-in accounts. Tokens are billed after each completed model reply, with free plans routed to efficient defaults.",
    highlights: [
      "Conversations and messages scoped to the logged-in user",
      "Server-side Anthropic / OpenAI calls using environment keys only",
      "Fast empty state when no conversations exist yet",
    ],
  },
  {
    id: "onboarding-admin-storage",
    version: "0.7.2",
    date: "April 2, 2026",
    type: "minor",
    title: "First-run onboarding, admin tools, and upload reliability",
    description:
      "New accounts complete a short guided onboarding flow. The platform owner has a server-enforced admin area for users, contacts, AI usage, storage failures, and token grants.",
    highlights: [
      "Profile bootstrap on OAuth callback with starter tokens",
      "Avatar, workspace icon, and media uploads log storage errors for review",
      "Community and explore tabs fail fast with guided empty states",
    ],
  },
  {
    id: "workspace-create",
    version: "0.4.0",
    date: "December 18, 2025",
    type: "patch",
    title: "Workspace shell, create flow, and auth proxy",
    description:
      "Early foundations for the signed-in shell: create workspace with preview panel, proxy-based session refresh aligned with Supabase, and pricing surfaces that reflect token-based usage.",
    highlights: [
      "Create flow with Discuss / Edit / Build modes",
      "Home and pricing iterations with honest staging of paid checkout",
      "Projects list and template shortcuts wired to Supabase where available",
    ],
  },
];
