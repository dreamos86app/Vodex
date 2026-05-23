/** Reusable UI patterns injected into generation prompts. */
export type UiPattern = {
  id: string;
  label: string;
  snippet: string;
  appTypes: string[];
};

export const UI_PATTERN_LIBRARY: UiPattern[] = [
  {
    id: "app-shell",
    label: "App shell with sidebar",
    appTypes: ["saas_dashboard", "saas", "dashboard", "admin_panel", "admin", "crm", "finance_dashboard"],
    snippet:
      "Use a sidebar + top bar shell: logo, nav links, user menu, main scroll area with max-w-7xl mx-auto p-4 md:p-6.",
  },
  {
    id: "metric-grid",
    label: "Metric cards grid",
    appTypes: ["saas_dashboard", "dashboard", "finance_dashboard", "finance", "crm"],
    snippet: "Hero metrics row: 3–4 stat cards with label, value, delta badge, and subtle ring border.",
  },
  {
    id: "data-table",
    label: "Filterable data table",
    appTypes: ["crm", "admin_panel", "admin", "saas_dashboard"],
    snippet: "Table with search input, column headers, row actions, empty state when no rows.",
  },
  {
    id: "landing-hero",
    label: "Landing hero + CTA",
    appTypes: ["landing", "marketing"],
    snippet: "Gradient hero, headline, subcopy, primary CTA, secondary link, feature grid below fold.",
  },
  {
    id: "mobile-stack",
    label: "Mobile-first stack",
    appTypes: ["habit_tracker", "habit", "mobile", "booking"],
    snippet: "Single-column stack, sticky bottom action bar, thumb-friendly tap targets (min h-11).",
  },
  {
    id: "form-wizard",
    label: "Multi-step form",
    appTypes: ["booking", "onboarding"],
    snippet: "Step indicator, validated fields, inline errors, back/next, summary on final step.",
  },
  {
    id: "ai-composer",
    label: "AI prompt composer",
    appTypes: ["ai_tool", "ai", "writing", "assistant"],
    snippet:
      "Split layout: prompt textarea, send button, streaming output panel, history sidebar with session list.",
  },
  {
    id: "community-feed",
    label: "Community feed",
    appTypes: ["community", "forum", "social"],
    snippet: "Post cards with avatar, title, body, comment thread, create-post FAB or header button.",
  },
  {
    id: "product-grid",
    label: "Product grid + cart",
    appTypes: ["ecommerce", "e-commerce", "shop", "store"],
    snippet: "Responsive product grid, price badges, add-to-cart buttons, cart drawer with line items and total.",
  },
  {
    id: "finance-chart",
    label: "Finance charts + ledger",
    appTypes: ["finance_dashboard", "finance", "budget"],
    snippet: "Budget summary cards, category breakdown chart, filterable transaction table, empty ledger state.",
  },
  {
    id: "habit-mobile",
    label: "Habit tracker mobile UI",
    appTypes: ["habit_tracker", "habit", "streak"],
    snippet: "Today view with habit cards, streak badges, check-in buttons, progress ring, bottom nav.",
  },
  {
    id: "state-trio",
    label: "Loading / empty / error trio",
    appTypes: ["saas_dashboard", "crm", "finance_dashboard", "admin_panel", "community", "ai_tool"],
    snippet: "Every list view: skeleton loading, illustrated empty state with CTA, inline error with retry.",
  },
];

export function patternsForAppType(appType: string | null | undefined): UiPattern[] {
  const t = (appType ?? "saas_dashboard").toLowerCase().replace(/-/g, "_");
  return UI_PATTERN_LIBRARY.filter((p) =>
    p.appTypes.some((a) => {
      const norm = a.replace(/-/g, "_");
      return t.includes(norm) || norm.includes(t) || t === norm;
    }),
  );
}

export function patternPromptBlock(appType: string | null | undefined): string {
  const patterns = patternsForAppType(appType);
  if (!patterns.length) return "";
  return ["UI PATTERN LIBRARY (apply where relevant):", ...patterns.map((p) => `- ${p.label}: ${p.snippet}`)].join(
    "\n",
  );
}
