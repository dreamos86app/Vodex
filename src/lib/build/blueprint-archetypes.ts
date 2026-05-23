/**
 * App-specific blueprint archetypes — senior product architect depth.
 */
import type { AppBlueprint } from "@/lib/build/blueprint-schema";

export type BlueprintArchetypeKey =
  | "crm"
  | "booking"
  | "finance"
  | "ai_tool"
  | "marketplace"
  | "saas"
  | "admin"
  | "ecommerce"
  | "social"
  | "landing"
  | "habit"
  | "portfolio"
  | "internal"
  | "learning"
  | "support"
  | "analytics";

export function detectArchetype(prompt: string, templateId?: string | null): BlueprintArchetypeKey {
  const p = prompt.toLowerCase();
  const t = (templateId ?? "").toLowerCase();
  if (t.includes("crm") || /\b(crm|sales pipeline|contacts|deals)\b/.test(p)) return "crm";
  if (t.includes("booking") || /\b(booking|salon|clinic|appointment|calendar)\b/.test(p)) return "booking";
  if (t.includes("finance") || /\b(finance|budget|transaction|expense|ledger)\b/.test(p)) return "finance";
  if (t.includes("ai") || /\b(ai|chatbot|assistant|llm|prompt)\b/.test(p)) return "ai_tool";
  if (t.includes("marketplace") || /\b(marketplace|seller|buyer|listing)\b/.test(p)) return "marketplace";
  if (t.includes("admin") || /\b(admin panel|audit log|roles)\b/.test(p)) return "admin";
  if (t.includes("ecommerce") || /\b(ecommerce|storefront|cart|checkout)\b/.test(p)) return "ecommerce";
  if (t.includes("social") || t.includes("community") || /\b(social|forum|feed|community)\b/.test(p))
    return "social";
  if (t.includes("habit") || t.includes("mobile") || /\b(habit|streak|mobile-first)\b/.test(p)) return "habit";
  if (t.includes("portfolio") || /\b(portfolio|creator)\b/.test(p)) return "portfolio";
  if (t.includes("learning") || t.includes("course") || /\b(course|lesson|learning)\b/.test(p)) return "learning";
  if (t.includes("support") || t.includes("helpdesk") || /\b(support|helpdesk|ticket)\b/.test(p)) return "support";
  if (t.includes("analytics") || t.includes("dashboard") || /\b(analytics|metrics|kpi)\b/.test(p))
    return "analytics";
  if (t.includes("landing") || /\b(landing|marketing site)\b/.test(p)) return "landing";
  if (/\b(internal tool|ops tool|workflow)\b/.test(p)) return "internal";
  if (/\b(saas|subscription|dashboard)\b/.test(p)) return "saas";
  return "saas";
}

type ArchetypePartial = Partial<AppBlueprint> & {
  appType: string;
  primaryUserJobs: string[];
  pages: AppBlueprint["pages"];
  routeMap: AppBlueprint["routeMap"];
};

const ARCHETYPES: Record<BlueprintArchetypeKey, ArchetypePartial> = {
  crm: {
    appType: "CRM",
    oneSentencePitch: "Manage contacts, deals, and follow-ups in one workspace.",
    targetUsers: "Sales teams, account managers, and small business owners",
    primaryUserJobs: ["Track contacts and companies", "Move deals through pipeline", "Log tasks and follow-ups"],
    pages: [
      { route: "/dashboard", purpose: "Pipeline overview and KPIs" },
      { route: "/contacts", purpose: "Contact list, search, and detail" },
      { route: "/deals", purpose: "Deal board with stages" },
      { route: "/tasks", purpose: "Tasks and follow-up reminders" },
      { route: "/reports", purpose: "Conversion and activity reports" },
    ],
    routeMap: [
      { route: "/dashboard", purpose: "Pipeline overview" },
      { route: "/contacts", purpose: "CRUD contacts" },
      { route: "/deals", purpose: "Stage-based deals" },
      { route: "/tasks", purpose: "Follow-ups" },
    ],
    componentMap: ["Pipeline board", "Contact table", "Deal card", "Task list", "Activity timeline"],
    dataModel: [
      { name: "contacts", columns: ["id", "name", "email", "company", "owner_id"] },
      { name: "deals", columns: ["id", "title", "stage", "value", "contact_id"] },
      { name: "tasks", columns: ["id", "title", "due_at", "contact_id", "deal_id"] },
    ],
    authModel: "Supabase Auth — users see own records; managers see team",
    permissionsModel: "Owner-scoped rows; admin role for /admin",
    adminModel: "Admin: user invites, pipeline settings, export",
    apiActionsPlan: ["List contacts", "Create deal", "Update stage", "Complete task"],
    backendRequirements: ["RLS on contacts/deals/tasks by owner_id", "Indexes on stage and due_at"],
    uiRequirements: ["Kanban deal board", "Contact detail drawer", "Empty pipeline state"],
    mobileStrategy: "Stacked cards on mobile; swipe actions on tasks",
    qualityChecklist: ["No Sample Item labels", "5+ distinct screens", "Real empty states"],
  },
  booking: {
    appType: "Booking",
    targetUsers: "Service businesses and their customers",
    primaryUserJobs: ["Browse services", "Pick a time slot", "Confirm booking", "Manage appointments"],
    pages: [
      { route: "/", purpose: "Service catalog and CTA" },
      { route: "/book", purpose: "Date/time picker flow" },
      { route: "/appointments", purpose: "Upcoming and past bookings" },
      { route: "/admin/calendar", purpose: "Staff calendar management" },
    ],
    routeMap: [
      { route: "/services", purpose: "Service list" },
      { route: "/book", purpose: "Availability + confirm" },
      { route: "/appointments", purpose: "User bookings" },
    ],
    dataModel: [
      { name: "services", columns: ["id", "name", "duration_min", "price"] },
      { name: "availability", columns: ["id", "staff_id", "starts_at", "ends_at"] },
      { name: "bookings", columns: ["id", "user_id", "service_id", "starts_at", "status"] },
    ],
    authModel: "Customers auth optional; staff/admin required for calendar",
    apiActionsPlan: ["List services", "Get slots", "Create booking", "Cancel booking"],
    backendRequirements: ["Conflict check on slots", "RLS: users see own bookings"],
    uiRequirements: ["Week calendar grid", "Confirmation step", "Reminder badge"],
    mobileStrategy: "Mobile-first booking wizard; sticky confirm bar",
    qualityChecklist: ["Time slots visible", "No fake payment success"],
  },
  finance: {
    appType: "Finance",
    targetUsers: "Individuals tracking money and budgets",
    primaryUserJobs: ["Track accounts", "Categorize transactions", "Set budgets", "View insights"],
    pages: [
      { route: "/dashboard", purpose: "Net worth and spending summary" },
      { route: "/accounts", purpose: "Account balances" },
      { route: "/transactions", purpose: "Transaction feed with filters" },
      { route: "/budgets", purpose: "Category budgets and progress" },
      { route: "/insights", purpose: "Trends and charts" },
    ],
    routeMap: [
      { route: "/dashboard", purpose: "Overview" },
      { route: "/transactions", purpose: "Ledger" },
      { route: "/budgets", purpose: "Budget tracking" },
    ],
    dataModel: [
      { name: "accounts", columns: ["id", "name", "type", "balance"] },
      { name: "transactions", columns: ["id", "account_id", "amount", "category", "occurred_at"] },
      { name: "budgets", columns: ["id", "category", "limit_amount", "period"] },
    ],
    authModel: "Required — all financial data user-scoped",
    backendRequirements: ["RLS per user_id", "Aggregate queries for charts"],
    uiRequirements: ["Charts with real axes", "Category chips", "Budget progress bars"],
    mobileStrategy: "Bottom nav; swipe between accounts and transactions",
    qualityChecklist: ["Currency formatting", "Empty account state"],
  },
  ai_tool: {
    appType: "AI tool",
    targetUsers: "Creators and teams using AI workflows",
    primaryUserJobs: ["Send prompts", "Review outputs", "Browse history", "Manage usage"],
    pages: [
      { route: "/chat", purpose: "Prompt input and streaming output" },
      { route: "/history", purpose: "Saved conversations" },
      { route: "/settings", purpose: "Model and preference settings" },
      { route: "/usage", purpose: "Usage summary (credits-safe)" },
    ],
    routeMap: [
      { route: "/chat", purpose: "Primary AI interface" },
      { route: "/history", purpose: "Conversation list" },
    ],
    dataModel: [
      { name: "conversations", columns: ["id", "user_id", "title", "created_at"] },
      { name: "messages", columns: ["id", "conversation_id", "role", "content"] },
    ],
    authModel: "Required for history; optional demo mode",
    apiActionsPlan: ["Stream completion", "Save message", "List history"],
    backendRequirements: ["Rate limits", "User-scoped conversations"],
    uiRequirements: ["Streaming bubbles", "Prompt templates", "Empty history state"],
    mobileStrategy: "Full-width chat; collapsible sidebar on desktop only",
    qualityChecklist: ["No fake model names in UI", "Stop/cancel control"],
  },
  marketplace: {
    appType: "Marketplace",
    targetUsers: "Buyers and sellers",
    primaryUserJobs: ["Browse listings", "Search and filter", "View seller profiles", "Complete purchase flow"],
    pages: [
      { route: "/", purpose: "Featured listings" },
      { route: "/search", purpose: "Search and filters" },
      { route: "/listing/[id]", purpose: "Listing detail" },
      { route: "/seller/dashboard", purpose: "Seller inventory" },
      { route: "/cart", purpose: "Cart and checkout preview" },
    ],
    routeMap: [
      { route: "/browse", purpose: "Grid of listings" },
      { route: "/listing/[id]", purpose: "Detail + seller" },
      { route: "/seller", purpose: "Seller tools" },
    ],
    dataModel: [
      { name: "listings", columns: ["id", "seller_id", "title", "price", "status"] },
      { name: "orders", columns: ["id", "buyer_id", "listing_id", "status"] },
      { name: "profiles", columns: ["id", "display_name", "seller_rating"] },
    ],
    authModel: "Buyers and sellers authenticated; public browse optional",
    backendRequirements: ["RLS: sellers edit own listings", "Order status workflow"],
    uiRequirements: ["Listing cards with image", "Filter sidebar", "Seller badge"],
    mobileStrategy: "2-column grid → single column; sticky cart FAB",
    qualityChecklist: ["Search UI works", "No fake checkout success"],
  },
  saas: {
    appType: "SaaS",
    targetUsers: "Team operators and admins",
    primaryUserJobs: ["Monitor KPIs", "Manage team", "Configure workspace"],
    pages: [
      { route: "/dashboard", purpose: "Metrics overview" },
      { route: "/team", purpose: "Members and roles" },
      { route: "/settings", purpose: "Workspace settings" },
      { route: "/billing", purpose: "Plan and usage (honest states)" },
    ],
    routeMap: [
      { route: "/dashboard", purpose: "Analytics home" },
      { route: "/team", purpose: "Collaboration" },
    ],
    dataModel: [{ name: "workspace_members", columns: ["id", "user_id", "role"] }],
    authModel: "Team auth with roles",
    uiRequirements: ["Sidebar nav", "Chart cards", "Settings forms"],
    mobileStrategy: "Collapsible sidebar; metric cards stack",
    qualityChecklist: ["Role-based nav items", "Loading skeletons"],
  },
  admin: {
    appType: "Admin dashboard",
    targetUsers: "Operators and support staff",
    primaryUserJobs: ["Manage users", "Review audit logs", "Configure system"],
    pages: [
      { route: "/admin", purpose: "Overview" },
      { route: "/admin/users", purpose: "User management" },
      { route: "/admin/audit", purpose: "Audit log table" },
      { route: "/admin/settings", purpose: "System settings" },
    ],
    routeMap: [
      { route: "/admin/users", purpose: "CRUD users" },
      { route: "/admin/audit", purpose: "Event log" },
    ],
    dataModel: [
      { name: "users", columns: ["id", "email", "role", "status"] },
      { name: "audit_events", columns: ["id", "actor_id", "action", "created_at"] },
    ],
    authModel: "Admin-only routes; role guard",
    adminModel: "Full admin surface",
    backendRequirements: ["Admin RLS policies", "Audit insert on mutations"],
    uiRequirements: ["Data tables with filters", "Role badges"],
    mobileStrategy: "Horizontal scroll tables on small screens",
    qualityChecklist: ["Admin gate messaging", "Pagination on audit"],
  },
  ecommerce: {
    appType: "E-commerce",
    targetUsers: "Shoppers",
    primaryUserJobs: ["Browse products", "Add to cart", "Review order summary"],
    pages: [
      { route: "/", purpose: "Product grid" },
      { route: "/product/[slug]", purpose: "Product detail" },
      { route: "/cart", purpose: "Cart review" },
    ],
    routeMap: [
      { route: "/", purpose: "Catalog" },
      { route: "/cart", purpose: "Cart" },
    ],
    dataModel: [
      { name: "products", columns: ["id", "name", "price", "inventory"] },
      { name: "cart_items", columns: ["id", "user_id", "product_id", "qty"] },
    ],
    uiRequirements: ["Product cards", "Quantity stepper", "Empty cart state"],
    mobileStrategy: "Mobile-first product grid",
    qualityChecklist: ["Price display", "No fake payment"],
  },
  social: {
    appType: "Social / community",
    targetUsers: "Community members",
    primaryUserJobs: ["Post content", "Follow users", "Comment and react"],
    pages: [
      { route: "/feed", purpose: "Main feed" },
      { route: "/profile/[id]", purpose: "User profile" },
      { route: "/notifications", purpose: "Activity alerts" },
    ],
    routeMap: [
      { route: "/feed", purpose: "Timeline" },
      { route: "/profile/[id]", purpose: "Profile" },
    ],
    dataModel: [
      { name: "posts", columns: ["id", "author_id", "body", "created_at"] },
      { name: "follows", columns: ["follower_id", "following_id"] },
    ],
    authModel: "Required for posting",
    uiRequirements: ["Post composer", "Avatar rows", "Empty feed state"],
    mobileStrategy: "Bottom tab bar; infinite scroll feed",
    qualityChecklist: ["Like/comment affordances"],
  },
  landing: {
    appType: "Landing page",
    targetUsers: "Visitors evaluating the product",
    primaryUserJobs: ["Understand value", "Sign up or request demo"],
    pages: [
      { route: "/", purpose: "Hero, features, social proof" },
      { route: "/pricing", purpose: "Plans and FAQ" },
    ],
    routeMap: [
      { route: "/", purpose: "Marketing home" },
      { route: "/pricing", purpose: "Conversion" },
    ],
    dataModel: [],
    authModel: "Public-first",
    uiRequirements: ["Hero CTA", "Feature grid", "Footer links"],
    mobileStrategy: "Single column sections; sticky CTA",
    qualityChecklist: ["No lorem ipsum", "Responsive typography"],
  },
  habit: {
    appType: "Habit tracker",
    targetUsers: "Mobile users building routines",
    primaryUserJobs: ["Check in daily", "Track streaks", "Review progress"],
    pages: [
      { route: "/today", purpose: "Daily check-in" },
      { route: "/habits", purpose: "Habit list" },
      { route: "/stats", purpose: "Streaks and charts" },
    ],
    routeMap: [
      { route: "/today", purpose: "Check-in UI" },
      { route: "/stats", purpose: "Progress" },
    ],
    dataModel: [{ name: "habit_logs", columns: ["id", "user_id", "habit_id", "logged_on"] }],
    mobileStrategy: "Touch-first; large tap targets; bottom nav",
    uiRequirements: ["Streak counter", "Celebration micro-interaction"],
    qualityChecklist: ["Mobile viewport tested", "Thumb-zone CTAs"],
  },
  portfolio: {
    appType: "Creator portfolio",
    targetUsers: "Creators showcasing work",
    primaryUserJobs: ["Show projects", "Share contact", "Tell story"],
    pages: [
      { route: "/", purpose: "Hero and featured work" },
      { route: "/projects", purpose: "Project grid" },
      { route: "/about", purpose: "Bio and links" },
    ],
    routeMap: [
      { route: "/", purpose: "Portfolio home" },
      { route: "/projects", purpose: "Work gallery" },
    ],
    uiRequirements: ["Project cards with tags", "Contact form"],
    mobileStrategy: "Image-forward single column",
    qualityChecklist: ["Real project titles", "Social links"],
  },
  internal: {
    appType: "Internal tool",
    targetUsers: "Internal team operators",
    primaryUserJobs: ["Track requests", "Assign owners", "Report status"],
    pages: [
      { route: "/requests", purpose: "Request queue" },
      { route: "/reports", purpose: "Ops metrics" },
    ],
    routeMap: [{ route: "/requests", purpose: "Workflow queue" }],
    authModel: "Team auth required",
    backendRequirements: ["Role-based access", "Audit on status change"],
    uiRequirements: ["Status badges", "Assignee picker"],
    qualityChecklist: ["Empty queue state"],
  },
  learning: {
    appType: "Learning / course",
    targetUsers: "Students and instructors",
    primaryUserJobs: ["Browse courses", "Complete lessons", "Track progress"],
    pages: [
      { route: "/courses", purpose: "Course catalog" },
      { route: "/course/[id]", purpose: "Lesson player" },
      { route: "/progress", purpose: "Completion tracking" },
    ],
    routeMap: [
      { route: "/courses", purpose: "Catalog" },
      { route: "/course/[id]", purpose: "Lessons" },
    ],
    dataModel: [
      { name: "courses", columns: ["id", "title", "level"] },
      { name: "lessons", columns: ["id", "course_id", "title", "order"] },
      { name: "progress", columns: ["user_id", "lesson_id", "completed_at"] },
    ],
    uiRequirements: ["Lesson sidebar", "Progress bar", "Continue CTA"],
    mobileStrategy: "Lesson list drawer on mobile",
    qualityChecklist: ["Progress persists in UI"],
  },
  support: {
    appType: "Support / helpdesk",
    targetUsers: "Customers and support agents",
    primaryUserJobs: ["Submit tickets", "Track status", "Agent triage"],
    pages: [
      { route: "/tickets", purpose: "Ticket list" },
      { route: "/tickets/new", purpose: "Create ticket" },
      { route: "/tickets/[id]", purpose: "Thread detail" },
    ],
    routeMap: [
      { route: "/tickets", purpose: "Support inbox" },
      { route: "/tickets/[id]", purpose: "Conversation" },
    ],
    dataModel: [{ name: "tickets", columns: ["id", "user_id", "subject", "status", "priority"] }],
    authModel: "Users see own tickets; agents see queue",
    backendRequirements: ["Status workflow", "RLS by role"],
    uiRequirements: ["Priority tags", "Reply composer"],
    qualityChecklist: ["Open/closed filters"],
  },
  analytics: {
    appType: "Analytics dashboard",
    targetUsers: "Data-driven teams and operators",
    primaryUserJobs: ["Monitor KPIs", "Filter date ranges", "Export summaries", "Configure data sources"],
    pages: [
      { route: "/dashboard", purpose: "KPI cards and charts" },
      { route: "/reports", purpose: "Saved reports and breakdowns" },
      { route: "/settings", purpose: "Data connections checklist" },
      { route: "/exports", purpose: "CSV export history" },
    ],
    routeMap: [
      { route: "/dashboard", purpose: "Metrics home" },
      { route: "/reports", purpose: "Report library" },
      { route: "/settings", purpose: "Connections" },
    ],
    dataModel: [{ name: "metrics_snapshots", columns: ["id", "metric", "value", "period", "owner_id"] }],
    authModel: "Team auth for saved reports",
    backendRequirements: ["Mock data layer for preview", "Connection checklist", "RLS on saved reports"],
    uiRequirements: ["Chart placeholders with labels", "Date range picker", "KPI delta badges"],
    mobileStrategy: "Stack KPI cards; scroll charts vertically",
    qualityChecklist: ["Multiple chart types", "Loading states on fetch", "Empty range state"],
  },
};

export function applyBlueprintArchetype(
  key: BlueprintArchetypeKey,
  prompt: string,
): Partial<AppBlueprint> {
  const base = ARCHETYPES[key];
  const name =
    prompt.match(/(?:for|build)\s+(?:me\s+)?(?:a\s+)?([A-Za-z0-9\s]{3,40})/i)?.[1]?.trim() ??
    base.appType;
  return {
    ...base,
    appName: name.slice(0, 48),
    oneSentencePitch: base.oneSentencePitch ?? prompt.slice(0, 200),
    routeMap: base.routeMap ?? base.pages,
    emptyStates: ["No records yet — add your first item", "No search results"],
    loadingStates: ["Skeleton rows while fetching", "Spinner on primary actions"],
    errorStates: ["Inline validation errors", "Retry banner on fetch failure"],
    previewAssumptions: ["Preview uses mock/seed data", "No live backend until configured"],
    publishAssumptions: ["Path-mode URL /p/slug when publish succeeds", "No fake subdomain"],
    exclusions: [
      "Native iOS/Android binaries",
      "Production payment without Stripe keys",
      "Live backend until Supabase connected",
    ],
    acceptanceCriteria: [
      ...(base.qualityChecklist ?? []),
      "All routes in routeMap render",
      "Mobile layout verified at 390px width",
      "Loading and empty states present",
    ],
    risks: ["Backend requires user Supabase configuration for live data"],
  };
}
