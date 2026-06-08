import type { AppArchetype, AppArchetypeId } from "@/lib/build/app-archetype-classifier";

export type GeneratedDesignSystem = {
  id: string;
  palette: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    muted: string;
    border: string;
  };
  typography: {
    fontScale: string;
    heading: string;
    body: string;
  };
  shape: {
    radius: string;
    cardShadow: string;
    buttonVariants: string;
  };
  components: {
    card: string;
    table: string;
    badge: string;
    emptyState: string;
    skeleton: string;
  };
  mobile: string;
  tailwindHints: string[];
};

const PALETTES: Record<AppArchetypeId, GeneratedDesignSystem["palette"]> = {
  subscription_box_manager: {
    primary: "#7c3aed",
    accent: "#06b6d4",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-500",
    border: "border-slate-200",
  },
  saas_dashboard: {
    primary: "#2563eb",
    accent: "#0ea5e9",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-500",
    border: "border-slate-200",
  },
  crm: {
    primary: "#4f46e5",
    accent: "#06b6d4",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-600",
    border: "border-slate-200",
  },
  restaurant_inventory: {
    primary: "#ea580c",
    accent: "#16a34a",
    background: "bg-stone-50",
    surface: "bg-white",
    muted: "text-stone-600",
    border: "border-stone-200",
  },
  marina_operations: {
    primary: "#0369a1",
    accent: "#0891b2",
    background: "bg-sky-50",
    surface: "bg-white",
    muted: "text-slate-600",
    border: "border-sky-100",
  },
  food_delivery_marketplace: {
    primary: "#00c2a8",
    accent: "#ff6b35",
    background: "bg-emerald-50/40",
    surface: "bg-white",
    muted: "text-slate-600",
    border: "border-emerald-100",
  },
  ecommerce: {
    primary: "#7c3aed",
    accent: "#f59e0b",
    background: "bg-zinc-50",
    surface: "bg-white",
    muted: "text-zinc-500",
    border: "border-zinc-200",
  },
  booking: {
    primary: "#db2777",
    accent: "#8b5cf6",
    background: "bg-rose-50",
    surface: "bg-white",
    muted: "text-rose-700/70",
    border: "border-rose-100",
  },
  finance_tracker: {
    primary: "#059669",
    accent: "#0284c7",
    background: "bg-emerald-50/40",
    surface: "bg-white",
    muted: "text-emerald-900/60",
    border: "border-emerald-100",
  },
  social_community: {
    primary: "#7c3aed",
    accent: "#ec4899",
    background: "bg-violet-50/30",
    surface: "bg-white",
    muted: "text-violet-900/50",
    border: "border-violet-100",
  },
  ai_tool: {
    primary: "#6366f1",
    accent: "#22d3ee",
    background: "bg-slate-950",
    surface: "bg-slate-900",
    muted: "text-slate-400",
    border: "border-slate-800",
  },
  marketplace: {
    primary: "#0d9488",
    accent: "#f97316",
    background: "bg-teal-50/40",
    surface: "bg-white",
    muted: "text-teal-900/55",
    border: "border-teal-100",
  },
  admin_panel: {
    primary: "#1e293b",
    accent: "#3b82f6",
    background: "bg-slate-100",
    surface: "bg-white",
    muted: "text-slate-500",
    border: "border-slate-200",
  },
  education: {
    primary: "#4f46e5",
    accent: "#f59e0b",
    background: "bg-indigo-50/30",
    surface: "bg-white",
    muted: "text-indigo-900/50",
    border: "border-indigo-100",
  },
  health_wellness: {
    primary: "#10b981",
    accent: "#8b5cf6",
    background: "bg-emerald-50",
    surface: "bg-white",
    muted: "text-emerald-800/60",
    border: "border-emerald-100",
  },
  real_estate: {
    primary: "#1d4ed8",
    accent: "#ca8a04",
    background: "bg-blue-50/30",
    surface: "bg-white",
    muted: "text-blue-900/50",
    border: "border-blue-100",
  },
  project_management: {
    primary: "#7c3aed",
    accent: "#06b6d4",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-600",
    border: "border-slate-200",
  },
  customer_support: {
    primary: "#2563eb",
    accent: "#f43f5e",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-500",
    border: "border-slate-200",
  },
  logistics_operations: {
    primary: "#0f766e",
    accent: "#f59e0b",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-600",
    border: "border-slate-200",
  },
  event_ticketing: {
    primary: "#7c3aed",
    accent: "#f43f5e",
    background: "bg-violet-50/30",
    surface: "bg-white",
    muted: "text-violet-900/55",
    border: "border-violet-100",
  },
  mental_wellness_journal: {
    primary: "#0d9488",
    accent: "#6366f1",
    background: "bg-gradient-to-b from-teal-50/80 to-white",
    surface: "bg-white/90",
    muted: "text-slate-600",
    border: "border-teal-100",
  },
  mediation_planner: {
    primary: "#1d4ed8",
    accent: "#7c3aed",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-600",
    border: "border-slate-200",
  },
  product_launch_pad: {
    primary: "#4f46e5",
    accent: "#06b6d4",
    background: "bg-gradient-to-b from-indigo-50/80 to-slate-50",
    surface: "bg-white",
    muted: "text-slate-600",
    border: "border-indigo-100",
  },
  generic_app: {
    primary: "#4f46e5",
    accent: "#0ea5e9",
    background: "bg-slate-50",
    surface: "bg-white",
    muted: "text-slate-500",
    border: "border-slate-200",
  },
};

export function buildGeneratedDesignSystem(archetype: AppArchetype): GeneratedDesignSystem {
  const palette = PALETTES[archetype.id] ?? PALETTES.generic_app;
  const dark = archetype.id === "ai_tool";

  return {
    id: `dreamos-${archetype.id}`,
    palette,
    typography: {
      fontScale: "text-sm base, text-lg/xl/2xl/3xl headings, font-medium/semibold/bold",
      heading: dark ? "text-white font-semibold tracking-tight" : "text-slate-900 font-semibold tracking-tight",
      body: dark ? "text-slate-300 text-sm leading-relaxed" : "text-slate-600 text-sm leading-relaxed",
    },
    shape: {
      radius: "rounded-xl cards, rounded-lg inputs, rounded-md badges",
      cardShadow: "shadow-sm hover:shadow-md transition-shadow ring-1 ring-black/5",
      buttonVariants: "primary filled, secondary outline, ghost — all with hover states",
    },
    components: {
      card: `${palette.surface} ${palette.border} border p-4 md:p-5 ${palette.muted}`,
      table: "w-full text-sm divide-y overflow-x-auto",
      badge: "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
      emptyState: "centered icon + title + helper + primary CTA",
      skeleton: "animate-pulse rounded-lg bg-slate-200/60",
    },
    mobile: "flex-col on mobile, sidebar collapses, tables scroll-x, sticky header, min-h-screen",
    tailwindHints: [
      palette.background,
      palette.surface,
      "gap-4 md:gap-6 p-4 sm:p-6",
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      "max-w-7xl mx-auto",
      dark ? "text-white" : "text-slate-900",
    ],
  };
}

export function designSystemPromptBlock(ds: GeneratedDesignSystem): string {
  return [
    "GENERATED DESIGN SYSTEM (apply consistently):",
    `Palette primary ${ds.palette.primary}, accent ${ds.palette.accent}`,
    `Surfaces: ${ds.palette.background}, ${ds.palette.surface}`,
    `Typography: ${ds.typography.fontScale}`,
    `Shape: ${ds.shape.radius}; cards use ${ds.shape.cardShadow}`,
    `Buttons: ${ds.shape.buttonVariants}`,
    `Components — card: ${ds.components.card}; table: ${ds.components.table}`,
    `Mobile: ${ds.mobile}`,
    `Tailwind: ${ds.tailwindHints.join(", ")}`,
  ].join("\n");
}
