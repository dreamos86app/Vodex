/** Design token presets — aligned with src/lib/create/style-presets.ts */
import { getStylePresetById, type StylePresetId } from "@/lib/create/style-presets";

export type DesignTokenPreset = {
  id: StylePresetId | string;
  label: string;
  colors: { primary: string; surface: string; accent: string; muted: string };
  typography: { fontFamily: string; headingWeight: string; bodySize: string };
  radius: string;
  shadow: string;
  buttonClass: string;
  cardClass: string;
  layoutHint: string;
  /** Patterns expected in generated UI when this preset is applied. */
  fingerprint: RegExp[];
};

export const DESIGN_TOKEN_PRESETS: DesignTokenPreset[] = [
  {
    id: "minimal",
    label: "Minimal",
    colors: { primary: "slate-900", surface: "white", accent: "slate-600", muted: "slate-500" },
    typography: { fontFamily: "Inter", headingWeight: "font-semibold", bodySize: "text-sm" },
    radius: "rounded-lg",
    shadow: "shadow-sm",
    buttonClass: "bg-slate-900 text-white rounded-lg px-4 py-2 shadow-sm",
    cardClass: "bg-white border border-slate-200 rounded-lg shadow-sm",
    layoutHint: "Generous whitespace, 1px borders, restrained palette, clear hierarchy.",
    fingerprint: [/slate-|shadow-sm|rounded-lg|border-slate|text-sm|font-semibold/i],
  },
  {
    id: "bold",
    label: "Bold",
    colors: { primary: "violet-600", surface: "zinc-950", accent: "fuchsia-500", muted: "zinc-400" },
    typography: { fontFamily: "Inter", headingWeight: "font-bold", bodySize: "text-base" },
    radius: "rounded-2xl",
    shadow: "shadow-lg shadow-violet-500/10",
    buttonClass: "bg-violet-600 text-white font-bold rounded-2xl px-6 py-3 shadow-lg",
    cardClass: "bg-zinc-900 border border-violet-500/20 rounded-2xl shadow-lg",
    layoutHint: "High contrast dark base, oversized headlines, vivid violet/fuchsia CTAs.",
    fingerprint: [/violet-|fuchsia-|font-bold|rounded-2xl|zinc-9|shadow-lg/i],
  },
  {
    id: "glass",
    label: "Glass",
    colors: { primary: "indigo-500", surface: "white/10", accent: "cyan-400", muted: "slate-400" },
    typography: { fontFamily: "Inter", headingWeight: "font-semibold", bodySize: "text-sm" },
    radius: "rounded-xl",
    shadow: "shadow-xl backdrop-blur",
    buttonClass: "backdrop-blur bg-white/20 border border-white/30 rounded-xl",
    cardClass: "backdrop-blur bg-white/10 border border-white/20 rounded-xl",
    layoutHint: "Frosted glass panels, gradient backgrounds, luminous accents, blur effects.",
    fingerprint: [/backdrop-blur|bg-white\/|gradient|glass|blur/i],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    colors: { primary: "blue-700", surface: "slate-50", accent: "sky-600", muted: "slate-600" },
    typography: { fontFamily: "Inter", headingWeight: "font-medium", bodySize: "text-sm" },
    radius: "rounded-md",
    shadow: "shadow-sm",
    buttonClass: "bg-blue-700 text-white rounded-md px-3 py-1.5 text-sm",
    cardClass: "bg-slate-50 border border-slate-200 rounded-md",
    layoutHint: "Dense data tables, sidebar nav, compact spacing, status chips.",
    fingerprint: [/blue-7|table|thead|compact|text-xs|rounded-md/i],
  },
];

export function getDesignTokens(stylePresetId: string | null | undefined): DesignTokenPreset {
  const id = (stylePresetId ?? "minimal").toLowerCase();
  const fromStyle = getStylePresetById(id);
  const preset = DESIGN_TOKEN_PRESETS.find((p) => p.id === id) ?? DESIGN_TOKEN_PRESETS[0]!;
  if (fromStyle) {
    return { ...preset, label: fromStyle.label, layoutHint: fromStyle.designDirection };
  }
  return preset;
}

export function designTokenPromptBlock(stylePresetId: string | null | undefined): string {
  const t = getDesignTokens(stylePresetId);
  const style = getStylePresetById(stylePresetId);
  return [
    `STYLE PRESET UI PLAN (${t.label}) — must materially change output:`,
    style ? `Direction: ${style.designDirection}` : "",
    `- Colors: primary ${t.colors.primary}, surface ${t.colors.surface}, accent ${t.colors.accent}`,
    `- Typography: ${t.typography.fontFamily}, ${t.typography.headingWeight}, ${t.typography.bodySize}`,
    `- Buttons: ${t.buttonClass}`,
    `- Cards: ${t.cardClass}`,
    `- Radius/shadow: ${t.radius}, ${t.shadow}`,
    `- Layout: ${t.layoutHint}`,
    `- Do NOT use generic defaults — preset must be visually distinct from other presets.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Score 0–100 how well generated UI reflects the chosen style preset. */
export function scoreStylePresetApplication(
  files: Array<{ path: string; content: string }>,
  stylePresetId: string | null | undefined,
): { score: number; matched: number; total: number } {
  const t = getDesignTokens(stylePresetId);
  const content = files.map((f) => f.content).join("\n");
  const matched = t.fingerprint.filter((p) => p.test(content)).length;
  const total = t.fingerprint.length;
  return { score: Math.round((matched / total) * 100), matched, total };
}

export function stylePresetBlocksDiffer(): boolean {
  const minimal = designTokenPromptBlock("minimal");
  const bold = designTokenPromptBlock("bold");
  const glass = designTokenPromptBlock("glass");
  const enterprise = designTokenPromptBlock("enterprise");
  const set = new Set([minimal, bold, glass, enterprise]);
  return set.size === 4;
}
