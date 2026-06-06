export type BackgroundPresetId =
  | "clean_white"
  | "soft_blue_white"
  | "icy_aurora"
  | "glass_frost"
  | "violet_glow"
  | "sunset_promo"
  | "critical_red_pulse"
  | "success_green_shimmer"
  | "dark_premium"
  | "animated_aurora_wave"
  | "animated_blue_plasma"
  | "animated_glass_sweep"
  | "animated_violet_shimmer"
  | "animated_icy_drift"
  | "animated_radial_glow"
  | "animated_constellation"
  | "animated_gradient_shimmer"
  | "ocean_teal"
  | "midnight_indigo"
  | "golden_hour"
  | "rose_blush"
  | "mint_fresh"
  | "charcoal_slate"
  | "animated_ocean_flow"
  | "animated_sunset_wave"
  | "animated_neon_pulse"
  /** @deprecated legacy ids — mapped in backgroundClass */
  | "animated_stars"
  | "animated_aurora"
  | "animated_floating_particles";

export type EffectPresetId =
  | "none"
  | "subtle_stars"
  | "glow_pulse"
  | "floating_sparkles"
  | "soft_radial_beam"
  | "animated_shine"
  | "status_pulse"
  | "promo_confetti"
  | "frost_particles"
  | "shimmer_line"
  | "floating_dots"
  | "tiny_stars"
  | "aurora_dust"
  | "border_shine"
  | "radial_spotlight"
  | "success_sparkle"
  | "warning_pulse"
  | "wave_ripple"
  | "soft_vignette"
  | "heartbeat"
  | "scan_line"
  | "particle_burst"
  | "color_shift";

export type IconPresetId =
  | "vodex_welcome"
  | "welcome_sparkle"
  | "megaphone"
  | "warning_triangle"
  | "gift"
  | "rocket"
  | "credit_bolt"
  | "shield"
  | "workspace_users"
  | "template_heart"
  | "wrench_status"
  | "integration_plug"
  | "crown_pro"
  | "check_success"
  | "discord_community"
  | "ai_wand"
  | "app_window"
  | "bell_alert"
  | "star_feature"
  | "flame_hot"
  | "globe_world"
  | "code_brackets"
  | "coin_dollar"
  | "calendar_event"
  | "thumbs_up";

export type MessageDesign = {
  backgroundPreset: BackgroundPresetId;
  effectPreset: EffectPresetId;
  iconPreset: IconPresetId;
  animatedIconEnabled: boolean;
  textColor: string;
  accentColor: string;
  outlineColor: string;
  buttonColor?: string;
};

export const DEFAULT_INBOX_DESIGN: MessageDesign = {
  backgroundPreset: "soft_blue_white",
  effectPreset: "glow_pulse",
  iconPreset: "vodex_welcome",
  animatedIconEnabled: true,
  textColor: "#0f172a",
  accentColor: "#2563eb",
  outlineColor: "#bae6fd",
};

export const DEFAULT_BANNER_DESIGN: MessageDesign = {
  backgroundPreset: "critical_red_pulse",
  effectPreset: "status_pulse",
  iconPreset: "warning_triangle",
  animatedIconEnabled: false,
  textColor: "#ffffff",
  accentColor: "#ffffff",
  outlineColor: "transparent",
  buttonColor: "#ffffff",
};

export const BACKGROUND_PRESETS: Array<{ id: BackgroundPresetId; label: string; animated?: boolean }> = [
  { id: "clean_white", label: "Clean white" },
  { id: "soft_blue_white", label: "Soft blue-white" },
  { id: "icy_aurora", label: "Icy aurora" },
  { id: "glass_frost", label: "Glass frost" },
  { id: "violet_glow", label: "Violet glow" },
  { id: "sunset_promo", label: "Sunset promo" },
  { id: "critical_red_pulse", label: "Critical red pulse" },
  { id: "success_green_shimmer", label: "Success green shimmer" },
  { id: "animated_gradient_shimmer", label: "Gradient shimmer", animated: true },
  { id: "animated_aurora_wave", label: "Aurora wave", animated: true },
  { id: "animated_blue_plasma", label: "Soft blue plasma", animated: true },
  { id: "animated_glass_sweep", label: "Glass light sweep", animated: true },
  { id: "animated_violet_shimmer", label: "Violet-blue shimmer", animated: true },
  { id: "animated_icy_drift", label: "Icy particle drift", animated: true },
  { id: "animated_radial_glow", label: "Radial glow motion", animated: true },
  { id: "animated_constellation", label: "Soft constellation", animated: true },
  { id: "ocean_teal", label: "Ocean teal" },
  { id: "midnight_indigo", label: "Midnight indigo" },
  { id: "golden_hour", label: "Golden hour" },
  { id: "rose_blush", label: "Rose blush" },
  { id: "mint_fresh", label: "Mint fresh" },
  { id: "charcoal_slate", label: "Charcoal slate" },
  { id: "animated_ocean_flow", label: "Ocean flow", animated: true },
  { id: "animated_sunset_wave", label: "Sunset wave", animated: true },
  { id: "animated_neon_pulse", label: "Neon pulse", animated: true },
];

export const EFFECT_PRESETS: Array<{ id: EffectPresetId; label: string }> = [
  { id: "none", label: "None" },
  { id: "glow_pulse", label: "Soft glow pulse" },
  { id: "shimmer_line", label: "Shimmer line" },
  { id: "floating_dots", label: "Floating dots" },
  { id: "tiny_stars", label: "Tiny stars" },
  { id: "aurora_dust", label: "Aurora dust" },
  { id: "border_shine", label: "Border shine" },
  { id: "radial_spotlight", label: "Radial spotlight" },
  { id: "success_sparkle", label: "Success sparkle" },
  { id: "warning_pulse", label: "Warning pulse" },
  { id: "subtle_stars", label: "Subtle stars" },
  { id: "floating_sparkles", label: "Floating sparkles" },
  { id: "soft_radial_beam", label: "Soft radial beam" },
  { id: "animated_shine", label: "Animated shine" },
  { id: "status_pulse", label: "Status pulse" },
  { id: "frost_particles", label: "Frost particles" },
  { id: "wave_ripple", label: "Wave ripple" },
  { id: "soft_vignette", label: "Soft vignette" },
  { id: "heartbeat", label: "Heartbeat glow" },
  { id: "scan_line", label: "Scan line" },
  { id: "particle_burst", label: "Particle burst" },
  { id: "color_shift", label: "Color shift" },
];

export const ICON_PRESETS: Array<{ id: IconPresetId; label: string; color: string }> = [
  { id: "vodex_welcome", label: "Vodex welcome orb", color: "#6366f1" },
  { id: "discord_community", label: "Discord / community", color: "#5865F2" },
  { id: "rocket", label: "Rocket / build", color: "#0ea5e9" },
  { id: "credit_bolt", label: "Credit bolt", color: "#f59e0b" },
  { id: "crown_pro", label: "Crown / upgrade", color: "#eab308" },
  { id: "shield", label: "Shield / security", color: "#059669" },
  { id: "wrench_status", label: "Status / wrench", color: "#64748b" },
  { id: "gift", label: "Gift", color: "#db2777" },
  { id: "template_heart", label: "Template heart", color: "#ec4899" },
  { id: "workspace_users", label: "Workspace people", color: "#6366f1" },
  { id: "check_success", label: "Success check", color: "#22c55e" },
  { id: "warning_triangle", label: "Warning", color: "#dc2626" },
  { id: "integration_plug", label: "Integration plug", color: "#14b8a6" },
  { id: "ai_wand", label: "AI wand", color: "#8b5cf6" },
  { id: "app_window", label: "App window", color: "#2563eb" },
  { id: "megaphone", label: "Megaphone", color: "#2563eb" },
  { id: "welcome_sparkle", label: "Welcome sparkle (legacy)", color: "#7c3aed" },
  { id: "bell_alert", label: "Bell alert", color: "#f97316" },
  { id: "star_feature", label: "Featured star", color: "#eab308" },
  { id: "flame_hot", label: "Hot / trending", color: "#ef4444" },
  { id: "globe_world", label: "Globe / global", color: "#0ea5e9" },
  { id: "code_brackets", label: "Code / dev", color: "#64748b" },
  { id: "coin_dollar", label: "Billing / credits", color: "#16a34a" },
  { id: "calendar_event", label: "Event / schedule", color: "#8b5cf6" },
  { id: "thumbs_up", label: "Thumbs up", color: "#22c55e" },
];

export function backgroundClass(id: BackgroundPresetId): string {
  const map: Record<BackgroundPresetId, string> = {
    clean_white: "bg-white dark:bg-slate-950",
    soft_blue_white:
      "bg-gradient-to-br from-sky-50 via-white to-indigo-50/80 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950/40",
    icy_aurora:
      "bg-gradient-to-br from-cyan-50/90 via-sky-50/70 to-violet-100/60 dark:from-cyan-950/30 dark:via-slate-900 dark:to-violet-950/30",
    glass_frost: "bg-white/70 backdrop-blur-md dark:bg-slate-900/70",
    violet_glow: "bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-fuchsia-500/15",
    sunset_promo: "bg-gradient-to-r from-orange-400/20 via-rose-400/15 to-violet-500/20",
    critical_red_pulse: "bg-gradient-to-r from-red-600 to-rose-500",
    success_green_shimmer: "bg-gradient-to-r from-emerald-500 to-teal-500",
    dark_premium: "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950",
    animated_gradient_shimmer: "vodex-bg-animated-shimmer",
    animated_aurora_wave: "vodex-bg-aurora-wave",
    animated_blue_plasma: "vodex-bg-blue-plasma",
    animated_glass_sweep: "vodex-bg-glass-sweep",
    animated_violet_shimmer: "vodex-bg-violet-shimmer",
    animated_icy_drift: "vodex-bg-icy-drift",
    animated_radial_glow: "vodex-bg-radial-glow",
    animated_constellation: "vodex-bg-constellation",
    animated_stars: "vodex-bg-animated-shimmer",
    animated_aurora: "vodex-bg-aurora-wave",
    animated_floating_particles: "vodex-bg-icy-drift",
    ocean_teal: "vodex-bg-ocean-teal",
    midnight_indigo: "vodex-bg-midnight-indigo",
    golden_hour: "vodex-bg-golden-hour",
    rose_blush: "vodex-bg-rose-blush",
    mint_fresh: "vodex-bg-mint-fresh",
    charcoal_slate: "vodex-bg-charcoal-slate",
    animated_ocean_flow: "vodex-bg-ocean-flow",
    animated_sunset_wave: "vodex-bg-sunset-wave",
    animated_neon_pulse: "vodex-bg-neon-pulse",
  };
  return map[id] ?? map.soft_blue_white;
}

export function effectOverlayClass(id: EffectPresetId): string | null {
  const map: Partial<Record<EffectPresetId, string>> = {
    subtle_stars: "vodex-effect-subtle-stars",
    tiny_stars: "vodex-effect-tiny-stars",
    glow_pulse: "vodex-effect-glow-pulse",
    floating_sparkles: "vodex-effect-floating-sparkles",
    floating_dots: "vodex-effect-floating-dots",
    soft_radial_beam: "vodex-effect-radial-beam",
    radial_spotlight: "vodex-effect-radial-spotlight",
    animated_shine: "vodex-effect-shine",
    shimmer_line: "vodex-effect-shimmer-line",
    status_pulse: "vodex-effect-status-pulse",
    warning_pulse: "vodex-effect-warning-pulse",
    promo_confetti: "vodex-effect-confetti",
    success_sparkle: "vodex-effect-success-sparkle",
    frost_particles: "vodex-effect-frost",
    aurora_dust: "vodex-effect-aurora-dust",
    border_shine: "vodex-effect-border-shine",
    wave_ripple: "vodex-effect-wave-ripple",
    soft_vignette: "vodex-effect-soft-vignette",
    heartbeat: "vodex-effect-heartbeat",
    scan_line: "vodex-effect-scan-line",
    particle_burst: "vodex-effect-particle-burst",
    color_shift: "vodex-effect-color-shift",
  };
  return map[id] ?? null;
}

export function isAnimatedBackground(id: BackgroundPresetId): boolean {
  return id.startsWith("animated_");
}

/** Ensures effect/background layers stack correctly in preview and live UI. */
export function messageDesignSurfaceClass(effectCls: string | null): string {
  return ["relative overflow-hidden", effectCls].filter(Boolean).join(" ");
}
