import type { AppArchetype, AppArchetypeId } from "@/lib/build/app-archetype-classifier";

export type DeterministicBuildPlan = {
  complexity: number;
  summary: string;
  steps: string[];
  pages: string[];
  entities: string[];
  core_v1_only: boolean;
  queued_later: string[];
};

const KNOWN_FAST_PATH_ARCHETYPES = new Set<AppArchetypeId>([
  "mental_wellness_journal",
  "subscription_box_manager",
  "restaurant_inventory",
  "crm",
  "booking",
  "finance_tracker",
  "ecommerce",
  "food_delivery_marketplace",
  "recipe_cookbook",
  "marketplace",
  "customer_support",
]);

export function hasDeterministicArchetypePlan(archetypeId: string): boolean {
  return KNOWN_FAST_PATH_ARCHETYPES.has(archetypeId as AppArchetypeId);
}

export function buildDeterministicPlanForArchetype(
  archetype: AppArchetype,
  executionBrief: string,
): DeterministicBuildPlan {
  const routes = archetype.coreRoutes?.length ? archetype.coreRoutes : ["/dashboard"];
  const pages = routes.map((r) => {
    const slug = r.replace(/^\//, "") || "dashboard";
    return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
  });

  const summary =
    archetype.id === "restaurant_inventory"
      ? "Restaurant inventory dashboard with stock, suppliers, alerts, and settings."
      : archetype.id === "mental_wellness_journal"
        ? "Mental wellness journal with mood check-ins, guided prompts, insights, and encrypted messaging."
        : archetype.id === "subscription_box_manager"
          ? "Subscription box manager with subscribers, curation, shipments, and churn analytics."
          : `${archetype.label} app with core operational screens.`;

  const steps = [
    "App shell and navigation",
    "Dashboard overview",
    ...pages.slice(1, 5).map((p) => `${p} screen`),
    "Polish UI and empty states",
  ];

  const entities =
    archetype.id === "restaurant_inventory"
      ? ["inventory_items", "suppliers", "stock_alerts", "purchase_orders"]
      : ["records", "users", "settings"];

  const briefLower = executionBrief.toLowerCase();
  const queued: string[] = [];
  if (/payment|stripe|billing/.test(briefLower)) queued.push("Payments integration");
  if (/mobile|ios|android/.test(briefLower)) queued.push("Mobile app wrapper");

  return {
    complexity:
      archetype.id === "mental_wellness_journal"
        ? 7
        : archetype.id === "subscription_box_manager"
          ? 6
          : archetype.id === "restaurant_inventory"
            ? 5
            : 4,
    summary,
    steps,
    pages: pages.length ? pages : ["Dashboard", "Settings"],
    entities,
    core_v1_only: true,
    queued_later: queued,
  };
}

export function deterministicPlanToJson(plan: DeterministicBuildPlan): string {
  return JSON.stringify(plan);
}
