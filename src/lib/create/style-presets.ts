/**
 * Style presets wired into blueprint + build prompts (not UI-only).
 */

export type StylePresetId = "minimal" | "bold" | "glass" | "enterprise";

export type StylePresetDef = {
  id: StylePresetId;
  label: string;
  hint: string;
  designDirection: string;
  designSystem: string;
};

export const STYLE_PRESET_DEFS: StylePresetDef[] = [
  {
    id: "minimal",
    label: "Minimal",
    hint: "Clean whitespace, subtle borders",
    designDirection: "Minimal SaaS: generous whitespace, 1px borders, restrained color, clear hierarchy.",
    designSystem: "Neutral palette, Inter-like typography, subtle shadows, no heavy gradients.",
  },
  {
    id: "bold",
    label: "Bold",
    hint: "Strong contrast, large type",
    designDirection: "Bold marketing: high contrast, oversized headlines, vivid accent CTAs.",
    designSystem: "Strong primary accent, large display type, card stacks with depth.",
  },
  {
    id: "glass",
    label: "Glass",
    hint: "Blur panels, soft gradients",
    designDirection: "Glassmorphism: frosted panels, soft gradients, luminous accents on dark or light base.",
    designSystem: "backdrop-blur panels, gradient meshes, soft glow on primary actions.",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    hint: "Dense data, neutral palette",
    designDirection: "Enterprise dashboard: dense tables, sidebar nav, neutral grays, status chips.",
    designSystem: "Compact spacing, data tables, filter bars, monospace metrics where helpful.",
  },
];

export function getStylePresetById(id: string | null | undefined): StylePresetDef | null {
  if (!id) return null;
  return STYLE_PRESET_DEFS.find((p) => p.id === id) ?? null;
}

/** Fragment injected into blueprint design fields and build system prompts. */
export function stylePresetDesignFragment(id: string | null | undefined): string {
  const p = getStylePresetById(id);
  return p ? `${p.designDirection} System: ${p.designSystem}` : "";
}

export function applyStylePresetToBlueprint<T extends { designSystem?: string; designDirection?: string }>(
  blueprint: T,
  stylePresetId: string | null | undefined,
): T {
  const p = getStylePresetById(stylePresetId);
  if (!p) return blueprint;
  return {
    ...blueprint,
    designSystem: p.designSystem,
    designDirection: p.designDirection,
  };
}
