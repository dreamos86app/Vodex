/** Production UI quality requirements for generated apps. */
import { appTypePromptBlock } from "@/lib/generation/app-type-ui-requirements";
import { designTokenPromptBlock } from "@/lib/generation/design-token-presets";
import { patternPromptBlock } from "@/lib/generation/ui-pattern-library";

export type UiQualityDimension =
  | "typography"
  | "spacing"
  | "layoutCompleteness"
  | "responsiveReadiness"
  | "appRelevance"
  | "visualPolish"
  | "interactivity"
  | "placeholderRisk"
  | "stateCoverage"
  | "routeCompleteness"
  | "stylePresetApplication"
  /** @deprecated use visualPolish — kept for backward-compatible issue keys */
  | "colorConsistency"
  /** @deprecated use visualPolish — kept for backward-compatible issue keys */
  | "componentQuality";

export type UiQualityThresholds = {
  minOverall: number;
  minPerDimension: number;
  polishIfBelow: number;
  minAppTypeCompliance: number;
  minStylePresetScore: number;
  minRouteCompleteness: number;
  minStateCoverage: number;
  minPlaceholderRisk: number;
};

/** Live benchmark targets — used by benchmark:smoke / benchmark:score. */
export const UI_QUALITY_BENCHMARK_TARGETS = {
  buildSuccessRate: 0.9,
  placeholderRate: 0.05,
  averageUiScore: 88,
  previewSuccessRate: 0.85,
} as const;

/** Gate for generated / preview_ready — apps below this stay needs_attention. */
export const UI_QUALITY_THRESHOLDS: UiQualityThresholds = {
  minOverall: 82,
  minPerDimension: 50,
  polishIfBelow: 88,
  minAppTypeCompliance: 72,
  minStylePresetScore: 40,
  minRouteCompleteness: 70,
  minStateCoverage: 55,
  minPlaceholderRisk: 70,
};

export const UI_QUALITY_BANNED = [
  /coming soon/i,
  /lorem ipsum/i,
  /your app will appear here/i,
  /waiting for app/i,
  /placeholder hero/i,
  /TODO:\s*implement/i,
  /TODO\b/i,
  /FIXME/i,
  /fake button/i,
  /under construction/i,
  /main content goes here/i,
  /not implemented yet/i,
  /page under development/i,
  /click here to start/i,
  /sample data only/i,
  /replace with real/i,
] as const;

export const UI_QUALITY_REQUIRED_PATTERNS = {
  navigation: /nav|sidebar|menu|header|Link href|tab bar/i,
  buttons: /button|btn|onClick|type="submit"/i,
  cards: /card|rounded|shadow|ring-1|border/i,
  typography: /text-(xs|sm|base|lg|xl|2xl|3xl)|font-(medium|semibold|bold)/i,
  spacing: /gap-[0-9]|p-[0-9]|px-|py-|space-y-|space-x-|m-[0-9]/i,
  responsive: /sm:|md:|lg:|flex-col|grid-cols|max-w-|min-h-screen/i,
  emptyState: /empty|no (data|items|results|contacts|transactions|posts)|get started|nothing here/i,
  loadingState: /loading|skeleton|spinner|isLoading|animate-pulse/i,
  errorState: /error|try again|failed|something went wrong/i,
  forms: /input|textarea|select|form|onSubmit/i,
  tables: /table|thead|tbody|tr|td|th/i,
} as const;

export type UiGenerationContext = {
  stylePresetId?: string | null;
  templateId?: string | null;
  buildTier?: string | null;
  appType?: string | null;
  targetUsers?: string | null;
  designSystem?: Record<string, unknown> | null;
  routeMap?: string[] | null;
  componentMap?: string[] | null;
};

export function buildUiQualityPromptBlock(ctx: UiGenerationContext): string {
  const lines = [
    "UI QUALITY REQUIREMENTS (mandatory — low-quality output will be rejected):",
    "- Real navigation (header, sidebar, or tab bar) linking to all blueprint routes",
    "- Real page layouts with app-specific sections — not a single generic hero",
    "- Strong typography scale (text-sm through text-3xl) and consistent spacing (Tailwind gap/padding)",
    "- Mobile-first responsive layout (sm/md breakpoints, max-w containers, no horizontal overflow)",
    "- Loading, empty, and error states on every data view",
    "- Consistent cards, buttons, inputs — styled components, not raw unstyled HTML defaults",
    "- Every blueprint route must have a dedicated page file with real app-specific content",
    "- No TODO, FIXME, coming soon, lorem ipsum, or placeholder-only content",
    "- Core CTAs must be clickable (onClick/href) — no dead disabled-only primary actions",
    "- Content must match the app type (CRM looks like CRM, not generic landing)",
    "- Tables, forms, and metric cards where the app type requires them",
  ];
  if (ctx.stylePresetId) {
    lines.push(
      `- Style preset "${ctx.stylePresetId}" must materially affect colors, radius, buttons, cards`,
    );
  }
  if (ctx.templateId) lines.push(`- Template: ${ctx.templateId} — follow its layout structure`);
  if (ctx.buildTier) lines.push(`- Build tier ${ctx.buildTier}: component depth and polish match tier`);
  if (ctx.routeMap?.length) lines.push(`- Required routes (each needs a page): ${ctx.routeMap.join(", ")}`);
  return lines.join("\n");
}

/** Full UI generation standard block for build/blueprint prompts. */
export function buildFullUiGenerationBlock(ctx: UiGenerationContext): string {
  return [
    buildUiQualityPromptBlock(ctx),
    designTokenPromptBlock(ctx.stylePresetId),
    patternPromptBlock(ctx.appType ?? ctx.templateId),
    appTypePromptBlock(ctx.appType ?? ctx.templateId),
  ]
    .filter(Boolean)
    .join("\n\n");
}
