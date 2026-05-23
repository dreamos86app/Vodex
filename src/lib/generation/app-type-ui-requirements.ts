/**
 * Strict UI generation expectations per app archetype.
 * Used in build prompts and generated-ui-review scoring.
 */
export type AppTypeSection = {
  id: string;
  label: string;
  patterns: RegExp[];
  /** Minimum patterns that must match (default 1). */
  minMatches?: number;
};

export type AppTypeUiRequirement = {
  id: string;
  label: string;
  aliases: string[];
  templateIds: string[];
  requiredSections: AppTypeSection[];
  routeHints: RegExp[];
  minUiFiles: number;
  promptBlock: string;
};

export const APP_TYPE_UI_REQUIREMENTS: AppTypeUiRequirement[] = [
  {
    id: "landing",
    label: "Landing page",
    aliases: ["landing", "marketing", "homepage", "meditation"],
    templateIds: ["landing", "marketing-site", "smoke-landing"],
    requiredSections: [
      { id: "hero", label: "Hero", patterns: [/hero|headline|h1|Get started|Sign up|meditation/i] },
      { id: "problem_solution", label: "Problem/solution", patterns: [/problem|solution|pain|benefit|why|value prop/i] },
      { id: "cta", label: "CTA", patterns: [/button|cta|onClick|href.*signup|Get started|email/i] },
      { id: "features", label: "Features", patterns: [/feature|benefit|grid|card/i] },
      { id: "social_proof", label: "Social proof", patterns: [/testimonial|trusted|logo|customer|review|rating|stat/i] },
      { id: "faq_footer", label: "FAQ/footer", patterns: [/faq|footer|question|help|nav|header/i] },
    ],
    routeHints: [/\/$|index|landing|home/i],
    minUiFiles: 1,
    promptBlock:
      "Landing page: gradient or clean hero, headline + subcopy, primary CTA, feature grid, social proof or stats, footer. Mobile-first stack.",
  },
  {
    id: "saas_dashboard",
    label: "SaaS dashboard",
    aliases: ["saas", "dashboard", "analytics"],
    templateIds: ["saas-dashboard", "smoke-saas-dash"],
    requiredSections: [
      { id: "metrics", label: "Metric cards", patterns: [/metric|stat|card|revenue|users|kpi/i] },
      { id: "chart_table", label: "Chart/table/list", patterns: [/chart|graph|table|list|grid/i] },
      { id: "nav", label: "Navigation", patterns: [/sidebar|nav|menu|header/i] },
      { id: "filters", label: "Filters", patterns: [/filter|search|select|dropdown/i] },
      { id: "states", label: "States", patterns: [/loading|empty|error|skeleton/i] },
    ],
    routeHints: [/dashboard|analytics|overview|settings/i],
    minUiFiles: 2,
    promptBlock:
      "SaaS dashboard: sidebar shell, 3–4 metric cards, chart or data table, filters/search, team settings page, empty/loading/error states.",
  },
  {
    id: "crm",
    label: "CRM",
    aliases: ["crm", "sales", "pipeline", "dentist", "patient"],
    templateIds: ["crm", "smoke-crm"],
    requiredSections: [
      { id: "contacts", label: "Contacts", patterns: [/contact|customer|client|lead|patient/i] },
      { id: "deals", label: "Deals/pipeline", patterns: [/deal|pipeline|opportunity|stage|appointment/i] },
      { id: "tasks", label: "Tasks/follow-ups", patterns: [/task|follow.?up|activity|note/i] },
      { id: "dashboard", label: "Dashboard cards", patterns: [/dashboard|metric|card|stat/i] },
      { id: "search", label: "Filters/search", patterns: [/search|filter|sort/i] },
      { id: "form", label: "Form/modal/action", patterns: [/form|modal|dialog|onSubmit|Add /i] },
    ],
    routeHints: [/contact|deal|pipeline|crm|dashboard|patient|schedule/i],
    minUiFiles: 3,
    promptBlock:
      "CRM: contacts/patients list, deals/leads pipeline, tasks/follow-ups, dashboard summary cards, search/filter bar, at least one add/edit form or modal flow.",
  },
  {
    id: "booking",
    label: "Booking app",
    aliases: ["booking", "appointment", "salon", "schedule"],
    templateIds: ["booking", "smoke-booking"],
    requiredSections: [
      { id: "services", label: "Service list", patterns: [/service|stylist|provider|offering|salon/i] },
      { id: "calendar", label: "Date/time", patterns: [/calendar|date|time|slot|schedule|reminder/i] },
      { id: "summary", label: "Booking summary", patterns: [/summary|review|confirm|total/i] },
      { id: "confirmation", label: "Confirmation", patterns: [/confirm|success|booked|confirmation/i] },
      { id: "availability", label: "Availability empty", patterns: [/no slots|unavailable|empty|no times|fully booked/i] },
    ],
    routeHints: [/book|appointment|schedule|calendar/i],
    minUiFiles: 2,
    promptBlock:
      "Booking: browse services/stylists, pick date/time slot, booking summary step, confirmation state with reminders.",
  },
  {
    id: "finance_dashboard",
    label: "Finance dashboard",
    aliases: ["finance", "budget", "expense", "money", "transaction"],
    templateIds: ["finance-dashboard", "smoke-finance"],
    requiredSections: [
      { id: "balances", label: "Balances/metrics", patterns: [/balance|budget|income|expense|total/i] },
      { id: "transactions", label: "Transactions/categories", patterns: [/transaction|category|ledger|spend/i] },
      { id: "charts", label: "Charts", patterns: [/chart|graph|trend|progress/i] },
      { id: "filters", label: "Filters", patterns: [/filter|date|range|search/i] },
      { id: "insights", label: "Insights card", patterns: [/insight|summary|tip|recommend|forecast/i] },
    ],
    routeHints: [/finance|budget|transaction|dashboard/i],
    minUiFiles: 2,
    promptBlock:
      "Finance dashboard: balance/budget metric cards, transaction list or categories, trend chart, date/filter controls, empty state for no transactions.",
  },
  {
    id: "ai_tool",
    label: "AI writing tool",
    aliases: ["ai", "writing", "assistant", "chat", "stream"],
    templateIds: ["ai-tool", "smoke-ai-tool"],
    requiredSections: [
      { id: "prompt", label: "Prompt input", patterns: [/prompt|textarea|input|compose|message/i] },
      { id: "output", label: "Output/stream", patterns: [/output|response|stream|result|generate/i] },
      { id: "history", label: "History", patterns: [/history|session|previous|saved/i] },
      { id: "credits", label: "Usage/credits", patterns: [/credit|usage|quota|limit|remaining/i] },
      { id: "actions", label: "Actions", patterns: [/copy|regenerate|send|submit|onClick/i] },
    ],
    routeHints: [/chat|write|assistant|generate/i],
    minUiFiles: 2,
    promptBlock:
      "AI tool: prompt composer, streaming or result panel, history sidebar/list, copy/regenerate actions, loading state while generating.",
  },
  {
    id: "community",
    label: "Community app",
    aliases: ["community", "forum", "social", "post"],
    templateIds: ["community", "smoke-community"],
    requiredSections: [
      { id: "posts", label: "Posts feed", patterns: [/post|feed|thread|discussion/i] },
      { id: "comments", label: "Comments/likes", patterns: [/comment|reply|discussion|like|heart|upvote/i] },
      { id: "profiles", label: "Profiles", patterns: [/profile|user|avatar|member/i] },
      { id: "compose", label: "Create post", patterns: [/create|compose|new post|publish/i] },
    ],
    routeHints: [/community|forum|post|feed|profile/i],
    minUiFiles: 2,
    promptBlock:
      "Community: post feed, comment threads, user profiles/avatars, create-post action, empty feed state.",
  },
  {
    id: "admin_panel",
    label: "Admin panel",
    aliases: ["admin", "backoffice", "management", "audit"],
    templateIds: ["admin-panel", "smoke-admin"],
    requiredSections: [
      { id: "metrics", label: "Metrics", patterns: [/metric|stat|card|kpi|overview/i] },
      { id: "users", label: "User management", patterns: [/user|role|member|admin/i] },
      { id: "table", label: "Data table", patterns: [/table|thead|tbody|row|column/i] },
      { id: "filters", label: "Filters", patterns: [/filter|search|sort|select/i] },
      { id: "audit", label: "Audit/log", patterns: [/audit|log|activity|history/i] },
      { id: "actions", label: "Admin actions", patterns: [/edit|delete|ban|invite|onClick|settings/i] },
    ],
    routeHints: [/admin|users|settings|audit|roles/i],
    minUiFiles: 2,
    promptBlock:
      "Admin panel: user table with roles, action buttons, audit log table, search/filter, dense enterprise layout.",
  },
  {
    id: "habit_tracker",
    label: "Mobile habit tracker",
    aliases: ["habit", "tracker", "streak", "mobile", "check-in"],
    templateIds: ["habit-tracker", "smoke-mobile-habit"],
    requiredSections: [
      { id: "checkin", label: "Daily check-in", patterns: [/check.?in|habit|daily|today/i] },
      { id: "streaks", label: "Streaks", patterns: [/streak|count|days|progress/i] },
      { id: "chart", label: "Progress chart", patterns: [/chart|graph|progress|trend|bar/i] },
      { id: "mobile", label: "Mobile layout", patterns: [/sm:|flex-col|sticky|bottom|h-11|min-h/i] },
      { id: "list", label: "Habit list", patterns: [/list|habit|item|card/i] },
    ],
    routeHints: [/habit|track|today|home/i],
    minUiFiles: 1,
    promptBlock:
      "Mobile-first habit tracker: single-column layout, habit cards, streak counters, daily check-in CTA, sticky bottom action bar.",
  },
  {
    id: "ecommerce",
    label: "E-commerce mini app",
    aliases: ["ecommerce", "e-commerce", "shop", "store", "cart"],
    templateIds: ["ecommerce", "smoke-ecommerce"],
    requiredSections: [
      { id: "products", label: "Product grid", patterns: [/product|grid|catalog|item|storefront/i] },
      { id: "details", label: "Product details", patterns: [/detail|description|size|variant|image/i] },
      { id: "cart", label: "Cart", patterns: [/cart|basket|checkout|add to cart/i] },
      { id: "empty_cart", label: "Empty cart", patterns: [/empty cart|no items|cart is empty|start shopping/i] },
      { id: "price", label: "Pricing", patterns: [/\$|price|total|amount/i] },
      { id: "cta", label: "Purchase CTA", patterns: [/buy|checkout|order|onClick/i] },
    ],
    routeHints: [/shop|product|cart|store/i],
    minUiFiles: 2,
    promptBlock:
      "E-commerce mini: product grid with images/titles/prices, add-to-cart, cart summary with total, checkout CTA.",
  },
];

/** Map live-smoke benchmark prompt ids to app types. */
export const SMOKE_PROMPT_APP_TYPES: Record<string, string> = {
  "smoke-landing": "landing",
  "smoke-saas-dash": "saas_dashboard",
  "smoke-crm": "crm",
  "smoke-booking": "booking",
  "smoke-finance": "finance_dashboard",
  "smoke-ai-tool": "ai_tool",
  "smoke-community": "community",
  "smoke-admin": "admin_panel",
  "smoke-mobile-habit": "habit_tracker",
  "smoke-ecommerce": "ecommerce",
};

export function resolveAppTypeRequirement(appType: string | null | undefined): AppTypeUiRequirement | null {
  if (!appType) return null;
  const t = appType.toLowerCase().replace(/-/g, "_");
  const smoke = SMOKE_PROMPT_APP_TYPES[appType] ?? SMOKE_PROMPT_APP_TYPES[t];
  if (smoke) {
    return APP_TYPE_UI_REQUIREMENTS.find((r) => r.id === smoke) ?? null;
  }
  return (
    APP_TYPE_UI_REQUIREMENTS.find(
      (r) =>
        r.id === t ||
        r.templateIds.some((tid) => tid === t || tid === appType) ||
        r.aliases.some((a) => t.includes(a.replace(/-/g, "_")) || a.includes(t)),
    ) ?? null
  );
}

/** Infer app type from user prompt text (benchmark + build fallback). */
export function resolveAppTypeFromPrompt(prompt: string): AppTypeUiRequirement | null {
  const lower = prompt.toLowerCase();
  const ordered = [
    { id: "habit_tracker", hints: [/habit tracker|daily check-in|streaks/i] },
    { id: "ecommerce", hints: [/e-commerce|ecommerce|storefront|product grid|cart/i] },
    { id: "admin_panel", hints: [/admin panel|audit log|user management|roles/i] },
    { id: "community", hints: [/community|forum|posts.*comments/i] },
    { id: "ai_tool", hints: [/ai writing|writing assistant|prompt history|streaming/i] },
    { id: "finance_dashboard", hints: [/finance dashboard|budget|transaction categor/i] },
    { id: "booking", hints: [/booking app|salon|stylist calendar|appointment/i] },
    { id: "crm", hints: [/crm|dentist|patient notes|sales pipeline/i] },
    { id: "saas_dashboard", hints: [/saas|analytics dashboard|team settings/i] },
    { id: "landing", hints: [/landing page|marketing|email signup/i] },
  ];
  for (const entry of ordered) {
    if (entry.hints.some((h) => h.test(lower))) {
      return APP_TYPE_UI_REQUIREMENTS.find((r) => r.id === entry.id) ?? null;
    }
  }
  return null;
}

export function appTypePromptBlock(appType: string | null | undefined): string {
  const req = resolveAppTypeRequirement(appType);
  if (!req) return "";
  return [
    `APP-TYPE REQUIREMENTS (${req.label}):`,
    req.promptBlock,
    `- Minimum ${req.minUiFiles} UI page file(s) with real ${req.label.toLowerCase()} content`,
    `- Required sections: ${req.requiredSections.map((s) => s.label).join(", ")}`,
  ].join("\n");
}

export type AppTypeCompliance = {
  appTypeId: string | null;
  score: number;
  matchedSections: string[];
  missingSections: string[];
  routeCompleteness: number;
  issues: string[];
};

export function scoreAppTypeCompliance(input: {
  files: Array<{ path: string; content: string }>;
  appType?: string | null;
  routeMap?: string[] | null;
}): AppTypeCompliance {
  const req = resolveAppTypeRequirement(input.appType);
  if (!req) {
    return {
      appTypeId: null,
      score: 45,
      matchedSections: [],
      missingSections: [],
      routeCompleteness: 45,
      issues: ["unknown_app_type"],
    };
  }

  const uiContent = input.files
    .filter((f) => /\.(tsx|jsx|html)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");

  const matchedSections: string[] = [];
  const missingSections: string[] = [];
  const issues: string[] = [];

  for (const section of req.requiredSections) {
    const hits = section.patterns.filter((p) => p.test(uiContent)).length;
    const need = section.minMatches ?? 1;
    if (hits >= need) matchedSections.push(section.id);
    else {
      missingSections.push(section.id);
      issues.push(`missing_section:${section.id}`);
    }
  }

  const uiFiles = input.files.filter((f) => /\.(tsx|jsx|html)$/i.test(f.path)).length;
  if (uiFiles < req.minUiFiles) {
    issues.push(`min_ui_files:${uiFiles}<${req.minUiFiles}`);
  }

  let routeCompleteness = 100;
  if (input.routeMap?.length) {
    const paths = input.files.map((f) => f.path).join("\n");
    const missingRoutes = input.routeMap.filter(
      (r) => !paths.includes(r.replace(/^\//, "")) && !new RegExp(r.replace(/^\//, ""), "i").test(paths),
    );
    routeCompleteness = Math.round(
      ((input.routeMap.length - missingRoutes.length) / input.routeMap.length) * 100,
    );
    if (missingRoutes.length) issues.push(`missing_routes:${missingRoutes.slice(0, 3).join(",")}`);
  } else {
    const routeHits = req.routeHints.filter(
      (h) => h.test(uiContent) || input.files.some((f) => h.test(f.path)),
    ).length;
    routeCompleteness = Math.round((routeHits / Math.max(1, req.routeHints.length)) * 100);
  }

  const sectionScore = (matchedSections.length / req.requiredSections.length) * 70;
  const fileScore = uiFiles >= req.minUiFiles ? 15 : (uiFiles / req.minUiFiles) * 15;
  const routeScore = (routeCompleteness / 100) * 15;
  const score = Math.round(sectionScore + fileScore + routeScore);

  return { appTypeId: req.id, score, matchedSections, missingSections, routeCompleteness, issues };
}
