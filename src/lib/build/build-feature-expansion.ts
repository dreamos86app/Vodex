/**
 * Expands short or domain-specific app prompts into a concrete MVP spec before planning/codegen.
 */
import {
  classifyAppArchetype,
  type AppArchetypeId,
} from "@/lib/build/app-archetype-classifier";

const SHALLOW_MAX_CHARS = 320;
const SHALLOW_MAX_CLAUSES = 4;

export type BuildFeatureExpansion = {
  expanded: boolean;
  originalPrompt: string;
  executionPrompt: string;
  addedFeatures: string[];
  archetypeId: AppArchetypeId;
  expansionReason: "shallow" | "domain" | "none";
};

const ARCHETYPE_MVP_FEATURES: Partial<Record<AppArchetypeId, string[]>> = {
  restaurant_inventory: [
    "Inventory dashboard with KPI cards: total SKUs, low-stock count, expiring within 7 days, monthly waste %",
    "Ingredient records table with category, unit, par level, on-hand qty, supplier, and location",
    "Stock level views with color-coded status (ok / low / critical) and quick adjust actions",
    "Expiry date tracking with sortable list and 'use first' badges",
    "Low-stock alerts panel with reorder suggestions and threshold settings",
    "Categories taxonomy (produce, dairy, dry goods, proteins) with filters",
    "Shopping list generated from low-stock and par gaps with check-off UI",
    "Usage history log (deductions, waste, transfers) with simple chart",
    "Recipe suggestions using on-hand ingredients (3–6 sample recipes)",
    "Settings: units, default par levels, notification preferences",
    "Realistic sample data across all screens (no empty tables)",
    "Polished sidebar navigation and responsive dashboard layout",
  ],
  product_launch_pad: [
    "Overview dashboard: signup KPIs, conversion %, launch countdown, affiliate revenue, traffic + sales charts",
    "Launch campaigns list with status, goal, dates, and performance badges",
    "Waitlist management: funnel stages, signup table (12+ rows), export, segment filters",
    "Affiliate program: referral links, commission tiers, top affiliates table, payout status",
    "Orders & revenue screen with early-bird checkout history and MRR-style summary",
    "Analytics: launch-day traffic graph, sales graph, campaign comparison, cohort mini-chart",
    "Checkout settings: pricing tiers, early-bird limits, Stripe-ready UI (mock)",
    "Product editor for positioning, features, and hero copy",
    "Landing page builder preview with CTA hierarchy and social proof strip",
    "Email blast center with draft campaigns and audience segments",
    "Onboarding checklist for first-time founders (connect domain, publish waitlist, invite affiliates)",
    "Premium indigo/violet gradients, realistic mock data everywhere, no empty tables",
  ],
  mediation_planner: [
    "Dashboard with upcoming sessions, open disputes count, and agreement status KPIs",
    "Party profiles: organizations/people, roles, contact info, conflict summary",
    "Sessions calendar: schedule mediation, location/link, status, assigned mediator",
    "Agenda templates library with reusable sections and time blocks",
    "Private caucus notes per party with confidentiality badges",
    "Agreement drafting workspace with clauses, version history, signature status",
    "Tasks and follow-ups linked to sessions with due dates",
    "Document status tracker (draft, shared, signed)",
    "Settings for mediators, notification preferences, export",
    "Realistic mock data for parties, sessions, and draft agreements",
    "Polished sidebar navigation across all screens",
  ],
  finance_tracker: [
    "Dashboard with balance, spend trend, and category breakdown",
    "Transactions list with filters, search, and sample rows",
    "Budgets per category with progress bars",
    "Insights screen with monthly comparison cards",
    "Settings for currency and categories",
    "Sample data populated across views",
  ],
  saas_dashboard: [
    "Metrics dashboard with KPI cards and activity chart",
    "Users table with status filters",
    "Analytics view with trend lines",
    "Team/settings screen",
    "Sample data and polished empty states",
  ],
  recipe_cookbook: [
    "Home feed with featured recipe cards, cuisines, and quick filters",
    "Recipe grid with photos, cook time, servings, and difficulty",
    "Recipe detail with ingredients, steps, nutrition, and save button",
    "Meal plan weekly calendar with drag-and-drop recipes",
    "Shopping list generated from meal plan ingredients",
    "Favorites collection with recipe cards",
    "Search with cuisine, diet, and time filters",
    "Realistic mock recipes with real dish names — no placeholder labels",
    "Responsive mobile-first layout with warm food photography placeholders",
  ],
  food_delivery_marketplace: [
    "Home / discover restaurants with cuisine category chips and search",
    "Restaurant cards with ratings, ETA, and promo badges",
    "Restaurant detail with menu categories and real dish cards (photos, price, add to cart)",
    "Food item detail with modifiers and quantity stepper",
    "Sticky cart sheet with line items, fees, and checkout CTA",
    "Checkout flow: address, delivery time, payment method (mock UI)",
    "Live order tracking with delivery progress timeline and map placeholder",
    "Orders history with status badges (preparing, on the way, delivered)",
    "Favorites for restaurants and dishes",
    "Customer profile with addresses and payment methods",
    "Restaurant owner dashboard: incoming orders, menu editor, availability",
    "Courier dashboard: active delivery tasks, pickup/dropoff, status updates",
    "Admin dashboard: restaurant moderation, promos, reviews",
    "Realistic mock food data across all screens — no generic finance routes",
    "Mobile-first responsive layout with Wolt-inspired visual polish",
  ],
  generic_app: [
    "Primary dashboard with KPI summary cards and recent activity",
    "Core entity list screen with search, filters, and sample rows",
    "Detail/create flow for the main record type",
    "Reports or insights view with chart placeholders fed by mock data",
    "Settings screen (profile, preferences)",
    "Sidebar or top navigation linking all screens",
    "Realistic mock data — no placeholder-only pages",
  ],
};

const DOMAIN_PROMPTS: Array<{
  pattern: RegExp;
  archetypeId: AppArchetypeId;
}> = [
  {
    pattern: /launch\s*pad|product launch|waitlist|early[- ]?bird|affiliate|launch day analytics/i,
    archetypeId: "product_launch_pad",
  },
  {
    pattern: /mediation|mediator|caucus|party profiles|agreement drafting|agenda templates/i,
    archetypeId: "mediation_planner",
  },
  {
    pattern: /wolt|uber\s*eats|food\s*delivery|restaurant\s*menu|courier|delivery\s*tracking/i,
    archetypeId: "food_delivery_marketplace",
  },
  {
    pattern: /recipe app|cookbook|meal planner|full recipes|cooking app/i,
    archetypeId: "recipe_cookbook",
  },
  {
    pattern: /food inventory|ingredient stock|pantry|kitchen inventory/i,
    archetypeId: "restaurant_inventory",
  },
  { pattern: /recipe app|meal planner|cookbook/i, archetypeId: "restaurant_inventory" },
  { pattern: /pet (care|diary)|vet visit|pet health/i, archetypeId: "health_wellness" },
];

function countIntentClauses(prompt: string): number {
  return prompt
    .split(/\n|[;,]|(?:\band\b)/i)
    .map((p) => p.replace(/^[\d\-*•.]+\s*/, "").trim())
    .filter((p) => p.length > 6).length;
}

function isShallowPrompt(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed) return false;
  if (trimmed.length > 1200) return false;
  const clauses = countIntentClauses(trimmed);
  if (clauses >= SHALLOW_MAX_CLAUSES && trimmed.length > 180) return false;
  return trimmed.length <= SHALLOW_MAX_CHARS || clauses < SHALLOW_MAX_CLAUSES;
}

function detectDomainArchetype(prompt: string): AppArchetypeId | null {
  const lower = prompt.toLowerCase();
  for (const entry of DOMAIN_PROMPTS) {
    if (entry.pattern.test(lower)) return entry.archetypeId;
  }
  return null;
}

function featuresForArchetype(archetypeId: AppArchetypeId): string[] {
  return (
    ARCHETYPE_MVP_FEATURES[archetypeId] ??
    ARCHETYPE_MVP_FEATURES.generic_app ??
    []
  );
}

function buildExpandedPrompt(
  originalPrompt: string,
  archetypeId: AppArchetypeId,
  features: string[],
  reason: "shallow" | "domain",
): BuildFeatureExpansion {
  const archetype = classifyAppArchetype(originalPrompt);
  const label =
    archetypeId === "product_launch_pad"
      ? "Digital product launch pad"
      : archetypeId === "mediation_planner"
        ? "Mediation session planner"
      : archetypeId === "restaurant_inventory"
        ? "Inventory operations"
        : archetype.label;

  const executionPrompt = [
    `User request: ${originalPrompt}`,
    "",
    `Expanded MVP (${label}) — implement ALL of the following in the first build:`,
    ...features.map((f) => `- ${f}`),
    "",
    "Quality bar: dedicated route/page per major screen (minimum 4), shared app shell, mock data, production-polished UI.",
    "Do not ship a welcome-only home or three plain cards.",
    "All page.tsx files must be valid TSX with export default and no markdown fences.",
  ].join("\n");

  return {
    expanded: true,
    originalPrompt,
    executionPrompt,
    addedFeatures: features,
    archetypeId,
    expansionReason: reason,
  };
}

/** Expand vague or domain-specific prompts into an execution-ready MVP brief. */
export function expandBuildPromptIfShallow(rawPrompt: string): BuildFeatureExpansion {
  const originalPrompt = rawPrompt.trim();
  const classified = classifyAppArchetype(originalPrompt);
  const domainId = detectDomainArchetype(originalPrompt);

  if (domainId) {
    const features = featuresForArchetype(domainId);
    if (features.length) {
      return buildExpandedPrompt(originalPrompt, domainId, features, "domain");
    }
  }

  if (!isShallowPrompt(originalPrompt)) {
    return {
      expanded: false,
      originalPrompt,
      executionPrompt: originalPrompt,
      addedFeatures: [],
      archetypeId: classified.id,
      expansionReason: "none",
    };
  }

  const archetypeId = domainId ?? classified.id;
  const features = featuresForArchetype(archetypeId);
  if (!features.length) {
    return {
      expanded: false,
      originalPrompt,
      executionPrompt: originalPrompt,
      addedFeatures: [],
      archetypeId,
      expansionReason: "none",
    };
  }

  return buildExpandedPrompt(originalPrompt, archetypeId, features, "shallow");
}
