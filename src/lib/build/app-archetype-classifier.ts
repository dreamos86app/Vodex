/**
 * App archetype detection — drives layout, routes, tone, and UI patterns before code generation.
 */
import { resolveAppTypeFromPrompt } from "@/lib/generation/app-type-ui-requirements";

export type AppArchetypeId =
  | "subscription_box_manager"
  | "saas_dashboard"
  | "crm"
  | "restaurant_inventory"
  | "ecommerce"
  | "booking"
  | "finance_tracker"
  | "social_community"
  | "ai_tool"
  | "marketplace"
  | "admin_panel"
  | "education"
  | "health_wellness"
  | "real_estate"
  | "project_management"
  | "customer_support"
  | "logistics_operations"
  | "marina_operations"
  | "event_ticketing"
  | "generic_app";

export type AppArchetype = {
  id: AppArchetypeId;
  label: string;
  confidence: number;
  navigationStyle: "sidebar" | "top_nav" | "tabs" | "mobile_stack";
  coreRoutes: string[];
  primarySections: string[];
  visualTone: string;
  terminology: string[];
};

const ARCHETYPE_HINTS: Array<{ id: AppArchetypeId; patterns: RegExp[]; weight?: number }> = [
  {
    id: "subscription_box_manager",
    patterns: [
      /subscription box|subscriber list|monthly box|curation|churn analytics|shipping labels? export/i,
      /subscription manager|box manager|curate.*box/i,
    ],
  },
  { id: "restaurant_inventory", patterns: [/restaurant|food inventory|kitchen|pantry|supplier|waste|stock|ingredient/i] },
  {
    id: "event_ticketing",
    patterns: [/event ticketing|ticket(s)?\s+app|qr code ticket|organizer check-in|stripe payment|check-in dashboard/i],
  },
  { id: "crm", patterns: [/crm|dentist|patient|clinic|sales pipeline|contacts|leads/i] },
  { id: "booking", patterns: [/booking|appointment|schedule|calendar|salon|reservation/i] },
  { id: "ecommerce", patterns: [/e-?commerce|online store|shop|cart|product catalog/i] },
  { id: "finance_tracker", patterns: [/finance|budget|expense|ledger|invoice|transaction/i] },
  { id: "social_community", patterns: [/community|forum|social|feed|posts|members/i] },
  { id: "ai_tool", patterns: [/ai (?:tool|assistant|chat)|writing assistant|prompt|chatbot/i] },
  { id: "marketplace", patterns: [/marketplace|vendors|listings|buyers|sellers/i] },
  { id: "admin_panel", patterns: [/admin panel|backoffice|user management|audit log/i] },
  { id: "education", patterns: [/education|course|lesson|student|learning platform/i] },
  { id: "health_wellness", patterns: [/health|wellness|fitness|habit|workout|nutrition/i] },
  { id: "real_estate", patterns: [/real estate|property|listing|rental|tenant/i] },
  { id: "project_management", patterns: [/project management|kanban|tasks|sprint|roadmap/i] },
  { id: "customer_support", patterns: [/helpdesk|support ticket|customer support|zendesk/i] },
  { id: "logistics_operations", patterns: [/logistics|shipment|warehouse|fleet|delivery route/i] },
  { id: "saas_dashboard", patterns: [/saas|dashboard|analytics|metrics|kpi/i] },
];

const ARCHETYPE_DEFS: Record<AppArchetypeId, Omit<AppArchetype, "id" | "confidence">> = {
  subscription_box_manager: {
    label: "Subscription box manager",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/subscribers", "/boxes", "/shipments", "/analytics", "/settings"],
    primarySections: [
      "subscriber table",
      "monthly box curation",
      "shipping label export",
      "churn metrics",
      "MRR overview",
    ],
    visualTone: "modern subscription SaaS, clean logistics + analytics",
    terminology: ["subscribers", "boxes", "shipments", "churn", "MRR", "curation"],
  },
  saas_dashboard: {
    label: "SaaS dashboard",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/analytics", "/settings", "/team"],
    primarySections: ["metric cards", "activity chart", "data table", "filters", "quick actions"],
    visualTone: "clean, confident, modern SaaS",
    terminology: ["users", "revenue", "growth", "active accounts"],
  },
  crm: {
    label: "CRM",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/contacts", "/deals", "/tasks", "/reports"],
    primarySections: ["pipeline summary", "contact table", "tasks", "schedule", "add record modal"],
    visualTone: "trustworthy, soft, professional",
    terminology: ["contacts", "deals", "pipeline", "follow-ups"],
  },
  restaurant_inventory: {
    label: "Restaurant inventory",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/inventory", "/suppliers", "/alerts", "/settings"],
    primarySections: ["stock value", "low-stock alerts", "inventory table", "supplier orders", "waste %"],
    visualTone: "warm, operational, fresh, modern",
    terminology: ["items", "par level", "expiry", "reorder", "suppliers"],
  },
  ecommerce: {
    label: "E-commerce",
    navigationStyle: "top_nav",
    coreRoutes: ["/", "/products", "/cart", "/checkout", "/orders"],
    primarySections: ["product grid", "filters", "cart summary", "order status"],
    visualTone: "retail-forward, crisp, conversion-focused",
    terminology: ["products", "orders", "customers", "inventory"],
  },
  booking: {
    label: "Booking",
    navigationStyle: "tabs",
    coreRoutes: ["/services", "/calendar", "/bookings", "/confirm"],
    primarySections: ["service picker", "calendar slots", "booking summary", "confirmation"],
    visualTone: "friendly, calm, appointment-ready",
    terminology: ["appointments", "availability", "services", "clients"],
  },
  finance_tracker: {
    label: "Finance tracker",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/transactions", "/budgets", "/insights"],
    primarySections: ["balance cards", "spend chart", "transaction list", "category breakdown"],
    visualTone: "precise, calm, data-rich",
    terminology: ["transactions", "categories", "budget", "cash flow"],
  },
  social_community: {
    label: "Community",
    navigationStyle: "top_nav",
    coreRoutes: ["/feed", "/explore", "/profile", "/messages"],
    primarySections: ["post feed", "compose", "comments", "member profiles"],
    visualTone: "social, lively, readable",
    terminology: ["posts", "members", "comments", "groups"],
  },
  ai_tool: {
    label: "AI tool",
    navigationStyle: "sidebar",
    coreRoutes: ["/compose", "/history", "/settings"],
    primarySections: ["prompt composer", "output panel", "history list", "usage meter"],
    visualTone: "futuristic, focused, minimal chrome",
    terminology: ["prompts", "sessions", "outputs", "credits"],
  },
  marketplace: {
    label: "Marketplace",
    navigationStyle: "top_nav",
    coreRoutes: ["/browse", "/listing", "/messages", "/seller"],
    primarySections: ["listing grid", "filters", "seller cards", "inquiry CTA"],
    visualTone: "discovery-first, balanced trust",
    terminology: ["listings", "sellers", "buyers", "inquiries"],
  },
  admin_panel: {
    label: "Admin panel",
    navigationStyle: "sidebar",
    coreRoutes: ["/overview", "/users", "/roles", "/audit", "/settings"],
    primarySections: ["KPI row", "user table", "role badges", "audit log", "bulk actions"],
    visualTone: "dense, enterprise, high contrast",
    terminology: ["users", "roles", "permissions", "audit events"],
  },
  education: {
    label: "Education",
    navigationStyle: "sidebar",
    coreRoutes: ["/courses", "/lessons", "/progress", "/students"],
    primarySections: ["course cards", "lesson list", "progress ring", "enrollment table"],
    visualTone: "approachable, structured, encouraging",
    terminology: ["courses", "lessons", "students", "progress"],
  },
  health_wellness: {
    label: "Health & wellness",
    navigationStyle: "mobile_stack",
    coreRoutes: ["/today", "/habits", "/insights", "/profile"],
    primarySections: ["daily check-in", "streak cards", "progress chart", "habit list"],
    visualTone: "soft, motivational, mobile-first",
    terminology: ["habits", "streaks", "goals", "check-ins"],
  },
  real_estate: {
    label: "Real estate",
    navigationStyle: "sidebar",
    coreRoutes: ["/listings", "/clients", "/showings", "/pipeline"],
    primarySections: ["listing cards", "map/filter", "client table", "pipeline board"],
    visualTone: "premium, spacious, trustworthy",
    terminology: ["listings", "showings", "clients", "offers"],
  },
  project_management: {
    label: "Project management",
    navigationStyle: "sidebar",
    coreRoutes: ["/board", "/tasks", "/timeline", "/team"],
    primarySections: ["kanban board", "task list", "timeline", "team workload"],
    visualTone: "productive, clear status colors",
    terminology: ["tasks", "sprints", "owners", "due dates"],
  },
  customer_support: {
    label: "Customer support",
    navigationStyle: "sidebar",
    coreRoutes: ["/inbox", "/tickets", "/knowledge", "/reports"],
    primarySections: ["ticket queue", "priority badges", "reply composer", "SLA metrics"],
    visualTone: "support-ready, efficient",
    terminology: ["tickets", "agents", "priority", "resolution"],
  },
  logistics_operations: {
    label: "Logistics",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/shipments", "/routes", "/fleet"],
    primarySections: ["shipment table", "route map card", "status badges", "alerts panel"],
    visualTone: "operational, map-aware, status-driven",
    terminology: ["shipments", "routes", "drivers", "ETA"],
  },
  marina_operations: {
    label: "Marina management",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/slips", "/assignments", "/maintenance", "/owners"],
    primarySections: ["occupancy metrics", "slip assignment table", "maintenance queue", "owner notices", "weather card"],
    visualTone: "nautical, clean, operational premium",
    terminology: ["slips", "berths", "owners", "work orders", "occupancy"],
  },
  event_ticketing: {
    label: "Event ticketing",
    navigationStyle: "sidebar",
    coreRoutes: [
      "/dashboard",
      "/events",
      "/events/browse",
      "/checkout",
      "/tickets",
      "/organizer",
      "/check-in",
      "/orders",
    ],
    primarySections: [
      "event listings grid",
      "ticket checkout flow",
      "QR ticket preview",
      "organizer dashboard",
      "check-in scanner list",
      "sales KPIs",
    ],
    visualTone: "energetic, modern, conversion-focused",
    terminology: ["events", "tickets", "orders", "attendees", "check-in", "organizers"],
  },
  generic_app: {
    label: "Application",
    navigationStyle: "sidebar",
    coreRoutes: ["/dashboard", "/records", "/insights", "/settings"],
    primarySections: ["overview metrics", "primary data table", "filters", "detail panel", "activity feed"],
    visualTone: "modern SaaS, balanced, premium",
    terminology: ["records", "status", "overview", "insights"],
  },
};

/** Classify build intent into a production UI archetype. */
export function classifyAppArchetype(buildIntent: string): AppArchetype {
  const lower = buildIntent.toLowerCase();
  let best: AppArchetypeId = "generic_app";
  let bestScore = 0;

  for (const hint of ARCHETYPE_HINTS) {
    const hits = hint.patterns.filter((p) => p.test(lower)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = hint.id;
    }
  }

  if (bestScore === 0) {
    const legacy = resolveAppTypeFromPrompt(buildIntent);
    if (legacy) {
      const map: Record<string, AppArchetypeId> = {
        saas_dashboard: "saas_dashboard",
        crm: "crm",
        booking: "booking",
        finance_dashboard: "finance_tracker",
        ecommerce: "ecommerce",
        ai_tool: "ai_tool",
        community: "social_community",
        admin_panel: "admin_panel",
        habit_tracker: "health_wellness",
        landing: "generic_app",
      };
      best = map[legacy.id] ?? "generic_app";
      bestScore = 0.65;
    }
  }

  const def = ARCHETYPE_DEFS[best];
  return {
    id: best,
    ...def,
    confidence: bestScore > 0 ? Math.min(0.98, 0.55 + bestScore * 0.15) : 0.45,
  };
}

export function archetypeToLegacyAppType(id: AppArchetypeId): string {
  const map: Partial<Record<AppArchetypeId, string>> = {
    subscription_box_manager: "saas_dashboard",
    saas_dashboard: "saas_dashboard",
    crm: "crm",
    restaurant_inventory: "saas_dashboard",
    event_ticketing: "saas_dashboard",
    booking: "booking",
    finance_tracker: "finance_dashboard",
    ecommerce: "ecommerce",
    ai_tool: "ai_tool",
    social_community: "community",
    admin_panel: "admin_panel",
    health_wellness: "habit_tracker",
  };
  return map[id] ?? "saas_dashboard";
}
