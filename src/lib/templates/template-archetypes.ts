/**
 * Structured template generation inputs — real accelerators, not marketing cards.
 */
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { detectArchetype, applyBlueprintArchetype } from "@/lib/build/blueprint-archetypes";

export type CoreTemplateId =
  | "saas-landing"
  | "ai-assistant"
  | "marketplace"
  | "booking-app"
  | "social-platform"
  | "finance-app"
  | "crm"
  | "dashboard"
  | "ecommerce-mini"
  | "mobile-habit"
  | "portfolio"
  | "internal-tool"
  | "learning-course"
  | "support-helpdesk"
  | "analytics-dashboard";

/** Create-flow picker aliases → catalog IDs */
export const TEMPLATE_ID_ALIASES: Record<string, CoreTemplateId | null> = {
  saas: "saas-landing",
  mobile: "mobile-habit",
  ai: "ai-assistant",
  custom: null,
  "productivity-workspace": "internal-tool",
  "ai-chat": "ai-assistant",
  "team-wiki": "internal-tool",
  "mobile-app": "mobile-habit",
  "community-platform": "social-platform",
  "ai-saas-starter": "ai-assistant",
  "mobile-twa-play-store": "mobile-habit",
  "mobile-twa": "mobile-habit",
  "analytics-dashboard": "analytics-dashboard",
  "dashboard-starter": "analytics-dashboard",
  "marketplace-starter": "marketplace",
  "landing-waitlist": "saas-landing",
};

export type TemplateArchetype = {
  id: CoreTemplateId;
  name: string;
  category: string;
  description: string;
  appType: string;
  complexity: "simple" | "medium" | "advanced";
  creditTier: "starter" | "standard" | "advanced";
  benchmarkPromptId?: string;
  defaultRoutes: string[];
  defaultComponents: string[];
  defaultDataModel: AppBlueprint["dataModel"];
  defaultActions: string[];
  emptyStates: string[];
  loadingStates: string[];
  errorStates: string[];
  mobileStrategy: string;
  uiPatterns: string[];
  backendRequirements: string[];
  buildPlanHints: string[];
};

export const CORE_TEMPLATES: TemplateArchetype[] = [
  {
    id: "saas-landing",
    name: "SaaS landing",
    category: "marketing",
    description: "Conversion-focused landing with pricing and signup.",
    appType: "Landing page",
    complexity: "simple",
    creditTier: "starter",
    benchmarkPromptId: "smoke-landing",
    defaultRoutes: ["/", "/pricing", "/signup", "/faq"],
    defaultComponents: ["Hero", "Feature grid", "Pricing table", "FAQ", "Footer"],
    defaultDataModel: [{ name: "waitlist_signups", columns: ["id", "email", "source", "created_at"] }],
    defaultActions: ["Capture email", "Navigate to pricing", "View feature sections"],
    emptyStates: ["No FAQ items"],
    loadingStates: ["Skeleton hero"],
    errorStates: ["Form validation"],
    mobileStrategy: "Single-column sections; sticky CTA",
    uiPatterns: ["gradient hero", "social proof row"],
    backendRequirements: ["Optional waitlist table"],
    buildPlanHints: ["Marketing copy from prompt", "Honest pricing CTA only"],
  },
  {
    id: "ai-assistant",
    name: "AI assistant",
    category: "ai",
    description: "Chat UI with history and settings.",
    appType: "AI tool",
    complexity: "medium",
    creditTier: "standard",
    benchmarkPromptId: "smoke-ai-tool",
    defaultRoutes: ["/chat", "/history", "/settings", "/usage"],
    defaultComponents: ["Prompt box", "Message list", "Model selector", "Sidebar"],
    defaultDataModel: [
      { name: "conversations", columns: ["id", "user_id", "title"] },
      { name: "messages", columns: ["id", "conversation_id", "role", "content"] },
    ],
    defaultActions: ["Send message", "Save conversation", "Clear history"],
    emptyStates: ["No conversations yet"],
    loadingStates: ["Streaming indicator"],
    errorStates: ["Rate limit message"],
    mobileStrategy: "Full-width chat; history drawer",
    uiPatterns: ["streaming bubbles", "prompt chips"],
    backendRequirements: ["User-scoped conversations", "Rate limits"],
    buildPlanHints: ["Never expose internal model routing"],
  },
  {
    id: "marketplace",
    name: "Marketplace",
    category: "commerce",
    description: "Browse, search, seller and buyer flows.",
    appType: "Marketplace",
    complexity: "advanced",
    creditTier: "advanced",
    benchmarkPromptId: "smoke-ecommerce",
    defaultRoutes: ["/", "/search", "/listing/[id]", "/seller", "/cart"],
    defaultComponents: ["Listing grid", "Filters", "Seller card", "Cart drawer"],
    defaultDataModel: [
      { name: "listings", columns: ["id", "seller_id", "title", "price"] },
      { name: "orders", columns: ["id", "buyer_id", "status"] },
    ],
    defaultActions: ["Search", "Add to cart", "View seller"],
    emptyStates: ["No listings match filters"],
    loadingStates: ["Grid skeleton"],
    errorStates: ["Checkout unavailable until configured"],
    mobileStrategy: "2-col grid → 1-col; FAB cart",
    uiPatterns: ["listing cards", "price badges"],
    backendRequirements: ["RLS on listings by seller", "Order status enum"],
    buildPlanHints: ["No fake payment success"],
  },
  {
    id: "booking-app",
    name: "Booking app",
    category: "scheduling",
    description: "Services, slots, and confirmations.",
    appType: "Booking",
    complexity: "medium",
    creditTier: "standard",
    benchmarkPromptId: "smoke-booking",
    defaultRoutes: ["/services", "/book", "/appointments", "/settings"],
    defaultComponents: ["Service cards", "Calendar picker", "Confirmation summary"],
    defaultDataModel: [
      { name: "services", columns: ["id", "name", "duration_min"] },
      { name: "bookings", columns: ["id", "user_id", "starts_at", "status"] },
    ],
    defaultActions: ["Pick slot", "Confirm booking", "Cancel"],
    emptyStates: ["No upcoming appointments"],
    loadingStates: ["Calendar loading"],
    errorStates: ["Slot unavailable"],
    mobileStrategy: "Wizard steps with progress bar",
    uiPatterns: ["week grid", "time chips"],
    backendRequirements: ["Slot conflict prevention", "RLS on bookings"],
    buildPlanHints: ["Reminder UI only — no fake SMS"],
  },
  {
    id: "social-platform",
    name: "Social / community",
    category: "social",
    description: "Feed, profiles, and engagement.",
    appType: "Social / community",
    complexity: "advanced",
    creditTier: "advanced",
    benchmarkPromptId: "smoke-community",
    defaultRoutes: ["/feed", "/profile/[id]", "/notifications"],
    defaultComponents: ["Post composer", "Feed cards", "Profile header"],
    defaultDataModel: [
      { name: "posts", columns: ["id", "author_id", "body"] },
      { name: "follows", columns: ["follower_id", "following_id"] },
    ],
    defaultActions: ["Create post", "Like", "Follow"],
    emptyStates: ["Feed empty — follow people"],
    loadingStates: ["Feed skeleton"],
    errorStates: ["Post failed retry"],
    mobileStrategy: "Bottom tabs; infinite scroll",
    uiPatterns: ["avatar stack", "engagement row"],
    backendRequirements: ["Auth required to post", "RLS on posts"],
    buildPlanHints: ["Realtime optional — mock ok in preview"],
  },
  {
    id: "finance-app",
    name: "Finance app",
    category: "finance",
    description: "Accounts, transactions, budgets, insights.",
    appType: "Finance",
    complexity: "medium",
    creditTier: "standard",
    benchmarkPromptId: "smoke-finance",
    defaultRoutes: ["/dashboard", "/accounts", "/transactions", "/budgets"],
    defaultComponents: ["Balance cards", "Transaction table", "Budget bars", "Charts"],
    defaultDataModel: [
      { name: "accounts", columns: ["id", "name", "balance"] },
      { name: "transactions", columns: ["id", "amount", "category"] },
      { name: "budgets", columns: ["id", "category", "limit_amount"] },
    ],
    defaultActions: ["Add transaction", "Set budget", "Filter period"],
    emptyStates: ["No transactions this month"],
    loadingStates: ["Chart skeleton"],
    errorStates: ["Import failed"],
    mobileStrategy: "Bottom nav; swipe between views",
    uiPatterns: ["currency format", "category chips"],
    backendRequirements: ["User-scoped RLS", "Aggregate queries"],
    buildPlanHints: ["Mock data for preview"],
  },
  {
    id: "crm",
    name: "CRM",
    category: "crm",
    description: "Contacts, deals, tasks, pipeline.",
    appType: "CRM",
    complexity: "advanced",
    creditTier: "advanced",
    benchmarkPromptId: "smoke-crm",
    defaultRoutes: ["/dashboard", "/contacts", "/deals", "/tasks"],
    defaultComponents: ["Pipeline board", "Contact table", "Task list"],
    defaultDataModel: [
      { name: "contacts", columns: ["id", "name", "email", "company"] },
      { name: "deals", columns: ["id", "stage", "value", "contact_id"] },
      { name: "tasks", columns: ["id", "title", "due_at", "deal_id"] },
    ],
    defaultActions: ["Create contact", "Move deal stage", "Complete task"],
    emptyStates: ["Pipeline empty"],
    loadingStates: ["Board skeleton"],
    errorStates: ["Save conflict"],
    mobileStrategy: "Stacked deal cards on mobile",
    uiPatterns: ["kanban", "activity timeline"],
    backendRequirements: ["Owner-scoped RLS", "Stage indexes"],
    buildPlanHints: ["Industry-specific labels from prompt"],
  },
  {
    id: "dashboard",
    name: "Admin dashboard",
    category: "admin",
    description: "Users, audit, settings.",
    appType: "Admin dashboard",
    complexity: "medium",
    creditTier: "standard",
    benchmarkPromptId: "smoke-admin",
    defaultRoutes: ["/dashboard", "/team", "/settings", "/billing"],
    defaultComponents: ["KPI tiles", "Team table", "Settings forms", "Billing summary"],
    defaultDataModel: [
      { name: "users", columns: ["id", "email", "role"] },
      { name: "audit_events", columns: ["id", "action", "actor_id"] },
    ],
    defaultActions: ["Invite user", "Filter audit", "Change role"],
    emptyStates: ["No audit events"],
    loadingStates: ["Table skeleton"],
    errorStates: ["Permission denied state"],
    mobileStrategy: "Horizontal scroll tables",
    uiPatterns: ["role badges", "filter bar"],
    backendRequirements: ["Admin role guard", "Audit on mutations"],
    buildPlanHints: ["Never expose service keys"],
  },
  {
    id: "ecommerce-mini",
    name: "E-commerce mini",
    category: "commerce",
    description: "Product grid, detail, cart.",
    appType: "E-commerce",
    complexity: "medium",
    creditTier: "standard",
    defaultRoutes: ["/", "/product/[slug]", "/cart"],
    defaultComponents: ["Product grid", "Detail gallery", "Cart summary"],
    defaultDataModel: [
      { name: "products", columns: ["id", "name", "price"] },
      { name: "cart_items", columns: ["product_id", "qty"] },
    ],
    defaultActions: ["Add to cart", "Update quantity"],
    emptyStates: ["Cart empty"],
    loadingStates: ["Product skeleton"],
    errorStates: ["Out of stock"],
    mobileStrategy: "Mobile-first grid",
    uiPatterns: ["product cards", "qty stepper"],
    backendRequirements: ["Inventory field", "Cart persistence optional"],
    buildPlanHints: ["Stripe only when keys configured"],
  },
  {
    id: "mobile-habit",
    name: "Mobile habit tracker",
    category: "mobile",
    description: "Streaks, check-ins, progress.",
    appType: "Habit tracker",
    complexity: "simple",
    creditTier: "starter",
    benchmarkPromptId: "smoke-mobile-habit",
    defaultRoutes: ["/today", "/habits", "/stats", "/settings"],
    defaultComponents: ["Check-in button", "Streak counter", "Habit list", "Settings panel"],
    defaultDataModel: [{ name: "habit_logs", columns: ["habit_id", "logged_on", "user_id"] }],
    defaultActions: ["Log habit", "View streak"],
    emptyStates: ["No habits yet"],
    loadingStates: ["Pulse on check-in"],
    errorStates: ["Sync failed"],
    mobileStrategy: "Touch-first; bottom nav; 390px primary",
    uiPatterns: ["large tap targets", "celebration toast"],
    backendRequirements: ["User-scoped logs"],
    buildPlanHints: ["PWA-friendly layout"],
  },
  {
    id: "portfolio",
    name: "Creator portfolio",
    category: "portfolio",
    description: "Projects, about, contact.",
    appType: "Creator portfolio",
    complexity: "simple",
    creditTier: "starter",
    defaultRoutes: ["/", "/projects", "/about"],
    defaultComponents: ["Hero", "Project grid", "Contact form"],
    defaultDataModel: [],
    defaultActions: ["Submit contact", "Filter projects"],
    emptyStates: ["No projects tagged"],
    loadingStates: ["Image blur placeholder"],
    errorStates: ["Form errors"],
    mobileStrategy: "Image-forward single column",
    uiPatterns: ["project cards", "tag filters"],
    backendRequirements: ["Optional contact form endpoint"],
    buildPlanHints: ["Pull project titles from prompt"],
  },
  {
    id: "internal-tool",
    name: "Internal tool",
    category: "internal",
    description: "Request queue and ops metrics.",
    appType: "Internal tool",
    complexity: "medium",
    creditTier: "standard",
    defaultRoutes: ["/requests", "/reports"],
    defaultComponents: ["Queue table", "Status filter", "Assignee select"],
    defaultDataModel: [{ name: "requests", columns: ["id", "title", "status", "owner_id"] }],
    defaultActions: ["Assign", "Change status"],
    emptyStates: ["Queue clear"],
    loadingStates: ["Row skeleton"],
    errorStates: ["Conflict on assign"],
    mobileStrategy: "Card list on mobile",
    uiPatterns: ["status pills", "priority column"],
    backendRequirements: ["Team auth", "Audit trail"],
    buildPlanHints: ["Role-based views"],
  },
  {
    id: "learning-course",
    name: "Learning / course",
    category: "education",
    description: "Courses, lessons, progress.",
    appType: "Learning / course",
    complexity: "medium",
    creditTier: "standard",
    defaultRoutes: ["/courses", "/course/[id]", "/progress"],
    defaultComponents: ["Course cards", "Lesson sidebar", "Progress ring"],
    defaultDataModel: [
      { name: "courses", columns: ["id", "title"] },
      { name: "lessons", columns: ["id", "course_id", "title"] },
      { name: "progress", columns: ["user_id", "lesson_id"] },
    ],
    defaultActions: ["Mark complete", "Continue lesson"],
    emptyStates: ["No courses enrolled"],
    loadingStates: ["Lesson skeleton"],
    errorStates: ["Playback error"],
    mobileStrategy: "Drawer lesson list",
    uiPatterns: ["progress bar", "continue CTA"],
    backendRequirements: ["Progress tracking RLS"],
    buildPlanHints: ["Video placeholder honest"],
  },
  {
    id: "support-helpdesk",
    name: "Support / helpdesk",
    category: "support",
    description: "Tickets, threads, agent queue.",
    appType: "Support / helpdesk",
    complexity: "medium",
    creditTier: "standard",
    defaultRoutes: ["/tickets", "/tickets/new", "/tickets/[id]"],
    defaultComponents: ["Ticket list", "Thread view", "Priority tag"],
    defaultDataModel: [{ name: "tickets", columns: ["id", "subject", "status", "priority"] }],
    defaultActions: ["Create ticket", "Reply", "Close"],
    emptyStates: ["No open tickets"],
    loadingStates: ["Thread loading"],
    errorStates: ["Submit failed"],
    mobileStrategy: "Stacked ticket cards",
    uiPatterns: ["priority colors", "reply composer"],
    backendRequirements: ["RLS: user vs agent roles"],
    buildPlanHints: ["SLA labels optional"],
  },
  {
    id: "analytics-dashboard",
    name: "Analytics dashboard",
    category: "analytics",
    description: "KPIs, charts, reports.",
    appType: "Analytics dashboard",
    complexity: "medium",
    creditTier: "standard",
    benchmarkPromptId: "smoke-saas-dash",
    defaultRoutes: ["/dashboard", "/reports", "/settings", "/exports"],
    defaultComponents: ["KPI cards", "Line chart", "Date picker", "Export button", "Filter bar"],
    defaultDataModel: [{ name: "metrics_snapshots", columns: ["id", "metric", "value", "period"] }],
    defaultActions: ["Change date range", "Export CSV"],
    emptyStates: ["No data for range"],
    loadingStates: ["Chart skeleton"],
    errorStates: ["Connection required checklist"],
    mobileStrategy: "Stack KPI cards; scroll charts",
    uiPatterns: ["sparklines", "comparison deltas"],
    backendRequirements: ["Mock metrics for preview", "Connection checklist"],
    buildPlanHints: ["Label axes honestly"],
  },
];

export function resolveTemplateId(id: string | null | undefined): CoreTemplateId | null {
  if (!id || id === "custom") return null;
  if (TEMPLATE_ID_ALIASES[id] !== undefined) return TEMPLATE_ID_ALIASES[id];
  const found = CORE_TEMPLATES.find((t) => t.id === id);
  return found?.id ?? null;
}

export function getCoreTemplate(id: string): TemplateArchetype | undefined {
  const resolved = resolveTemplateId(id) ?? (id as CoreTemplateId);
  return CORE_TEMPLATES.find((t) => t.id === resolved);
}

export function blueprintFromTemplate(templateId: string, prompt: string): Partial<AppBlueprint> {
  const t = getCoreTemplate(templateId);
  if (!t) return {};
  const archetype = applyBlueprintArchetype(detectArchetype(prompt, templateId), prompt);
  const dataModel =
    t.defaultDataModel.length > 0 ? t.defaultDataModel : (archetype.dataModel ?? []);
  return {
    ...archetype,
    appType: t.appType,
    templateId: t.id,
    templateInfluence: `${t.name}: ${t.description}`,
    targetUsers: archetype.targetUsers ?? `${t.name} users`,
    pages: t.defaultRoutes.map((route) => ({ route, purpose: `${t.name} — ${route}` })),
    routeMap: t.defaultRoutes.map((route) => ({ route, purpose: `${t.name} screen` })),
    componentMap: t.defaultComponents,
    dataModel,
    primaryUserJobs: t.defaultActions,
    apiActionsPlan: t.defaultActions,
    emptyStates: t.emptyStates,
    loadingStates: t.loadingStates,
    errorStates: t.errorStates,
    mobileStrategy: t.mobileStrategy,
    responsiveStrategy: t.mobileStrategy,
    uiRequirements: t.uiPatterns,
    backendRequirements: [...t.backendRequirements, ...(archetype.backendRequirements ?? [])],
    qualityChecklist: [...(archetype.qualityChecklist ?? []), ...t.buildPlanHints],
    buildStages: ["Plan", "Blueprint", "UI", "Backend plan", "Preview", "Publish checklist"],
    estimatedComplexity: t.complexity === "advanced" ? 8 : t.complexity === "medium" ? 5 : 3,
    sourceMode: "template_assisted",
  };
}
