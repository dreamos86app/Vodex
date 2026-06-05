"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Gauge,
  ChevronUp,
  Coins,
  Search,
  CheckCheck,
  Sparkles,
  Lock,
  Zap,
} from "lucide-react";
import type { CreationModel, Rating1to5 } from "@/lib/creation/models";
import { CREATION_MODELS, FLAGSHIP_MODELS, ADDITIONAL_MODELS } from "@/lib/creation/models";
import {
  COMING_SOON_MODEL_IDS,
  COST_TIER_LABELS,
  COST_TIER_STYLES,
  costTierFromScore,
  formatModelRating,
  sortModelsForPicker,
} from "@/lib/creation/model-ratings";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { normalizePlanId } from "@/lib/billing/plans";
import { canSelectModel } from "@/lib/billing/plan-entitlements";
import { useCreditsStore } from "@/lib/stores/credits-store";
import { toast } from "@/lib/toast";

type ProviderAvailability = Record<string, "available" | "unavailable" | "coming_soon">;
type ModelAvailability = "ok" | "unavailable" | "coming_soon";

/** Fixed panel height — side detail + Use button must fit without scrolling. */
const PANEL_BODY_H = 348;

function modelAvailability(
  model: CreationModel,
  providers: ProviderAvailability | null,
): ModelAvailability {
  if (model.comingSoon || COMING_SOON_MODEL_IDS.has(model.id)) return "coming_soon";
  if (model.provider === "deepseek") return "coming_soon";
  if (!providers) return "ok";
  if (model.id === "grok-4" || model.provider === "xai") {
    return providers.xai === "coming_soon" ? "coming_soon" : providers.xai === "unavailable" ? "unavailable" : "ok";
  }
  const st = providers[model.provider];
  if (st === "coming_soon") return "coming_soon";
  if (st === "unavailable") return "unavailable";
  return "ok";
}

const AUTOMATIC_MODEL = {
  id: "automatic",
  name: "Automatic",
  provider: "anthropic" as const,
  tagline: "Best model for each step — cost-optimized routing",
  ratings: { intelligence: 5, reasoning: 5, frontend: 5, backend: 5, speed: 4, cost: 4, orchestration: 5 },
  multimodal: true,
  contextK: 200,
  credits: 0,
  specialization: "fullstack" as const,
  orchestrationRole: "Vodex picks the right model per task",
  idealFor: ["Most builds", "Balanced cost & quality", "Hands-off creation"],
  weaknesses: ["You don't control which model runs each sub-step"],
  accent: "#f59e0b",
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  deepseek: "DeepSeek",
  xai: "xAI",
  meta: "Meta",
  cohere: "Cohere",
  mistral: "Mistral",
};

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: "bg-orange-500/10 text-orange-600",
  openai: "bg-emerald-500/10 text-emerald-600",
  google: "bg-blue-500/10 text-blue-600",
  deepseek: "bg-violet-500/10 text-violet-600",
  xai: "bg-red-500/10 text-red-600",
  meta: "bg-sky-500/10 text-sky-600",
  cohere: "bg-fuchsia-500/10 text-fuchsia-600",
  mistral: "bg-orange-400/10 text-orange-500",
};

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 16 16"
          className={cn(
            "size-3.5 drop-shadow-sm",
            i + 0.5 <= value ? "text-amber-400" : i < value ? "text-amber-400/55" : "text-muted-foreground/25",
          )}
          fill="currentColor"
        >
          <path d="M8 1.2l1.8 3.6 3.9.6-2.8 2.8.7 3.9L8 10.2l-3.6 1.9.7-3.9L2.3 5.4l3.9-.6L8 1.2z" />
        </svg>
      ))}
    </span>
  );
}

function CostTierTag({ costScore }: { costScore: number }) {
  const tier = costTierFromScore(costScore);
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 py-px text-[7px] font-bold uppercase tracking-wide ring-1",
        COST_TIER_STYLES[tier],
      )}
    >
      {COST_TIER_LABELS[tier]}
    </span>
  );
}

function RatingCell({
  label,
  value,
  icon: Icon,
  costScore,
  hideCostTag,
}: {
  label: string;
  value: Rating1to5;
  icon: React.ElementType;
  costScore?: number;
  hideCostTag?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-muted/25 px-2 py-2 text-center ring-1 ring-border/50">
      <div className="flex items-center gap-1">
        <Icon className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span className="text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[13px] font-extrabold tabular-nums text-foreground">{formatModelRating(value)}/5</span>
        {label === "Cost" && costScore != null && !hideCostTag ? <CostTierTag costScore={costScore} /> : null}
      </div>
      <div className="mt-1">
        <StarRating value={value} />
      </div>
    </div>
  );
}

function UseButton({
  availability,
  onUse,
}: {
  availability: ModelAvailability;
  onUse: () => void;
}) {
  const comingSoon = availability === "coming_soon";
  const disabled = availability !== "ok";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onUse}
      className={cn(
        "relative w-full overflow-hidden rounded-xl py-2.5 text-[13px] font-bold tracking-wide transition",
        comingSoon
          ? "cursor-default bg-muted/80 text-muted-foreground ring-1 ring-border"
          : disabled
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950 shadow-[0_0_22px_rgba(251,191,36,0.45),0_6px_18px_-4px_rgba(245,158,11,0.55)] ring-1 ring-amber-300/60 hover:brightness-105",
      )}
    >
      {!disabled && !comingSoon && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl bg-amber-200/30 blur-md motion-reduce:hidden"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50 motion-reduce:hidden"
            style={{
              background:
                "linear-gradient(105deg, transparent 28%, rgba(255,255,255,0.55) 50%, transparent 72%)",
              animation: "plan-badge-shimmer 2.8s ease-in-out infinite",
            }}
          />
        </>
      )}
      <span className="relative">{comingSoon ? "Coming soon" : disabled ? "Unavailable" : "Use"}</span>
    </motion.button>
  );
}

function ModelSidePanel({
  model,
  active,
  availability,
  onUse,
}: {
  model: CreationModel;
  active: boolean;
  availability: ModelAvailability;
  onUse: () => void;
}) {
  const r = model.ratings;
  const comingSoon = availability === "coming_soon";

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-[248px] shrink-0 flex-col border-l border-border/70 bg-gradient-to-b from-background to-muted/15"
      style={{ height: PANEL_BODY_H }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 p-3 pb-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: model.accent }} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{model.name}</p>
                {active && <CheckCheck className="size-3 shrink-0 text-accent" strokeWidth={2} />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <span
                  className={cn(
                    "inline-flex rounded-full px-1.5 py-px text-[8px] font-semibold",
                    PROVIDER_COLOR[model.provider] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {PROVIDER_LABELS[model.provider]}
                </span>
                {comingSoon && (
                  <span className="rounded-full bg-violet-500/12 px-1.5 py-px text-[8px] font-semibold text-violet-700 ring-1 ring-violet-500/20">
                    Coming soon
                  </span>
                )}
                {!comingSoon && model.id !== "automatic" ? (
                  <CostTierTag costScore={r.cost} />
                ) : null}
              </div>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{model.tagline}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 scrollbar-thin">
          <div className="grid shrink-0 grid-cols-2 gap-1.5">
            <RatingCell label="Cost" value={r.cost} icon={Coins} costScore={r.cost} hideCostTag={comingSoon} />
            <RatingCell label="Speed" value={r.speed} icon={Gauge} />
            <RatingCell label="Code" value={r.intelligence} icon={Zap} />
            <RatingCell label="Reason" value={r.reasoning} icon={Brain} />
          </div>

          <div className="mt-2 rounded-lg bg-surface/70 px-2.5 py-2 ring-1 ring-border/50">
            <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/75">Best for</p>
            <ul className="mt-1 space-y-0.5">
              {model.idealFor.map((u) => (
                <li key={u} className="flex items-start gap-1 text-[10px] leading-snug text-foreground/80">
                  <span className="mt-1 size-0.5 shrink-0 rounded-full bg-accent" />
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border/50 bg-background/95 px-3 pb-3 pt-2 backdrop-blur-sm">
        <UseButton availability={availability} onUse={onUse} />
      </div>
    </motion.div>
  );
}

function ModelRow({
  model,
  active,
  preview,
  availability,
  onPreview,
}: {
  model: CreationModel;
  active: boolean;
  preview: boolean;
  availability: ModelAvailability;
  onPreview: () => void;
}) {
  const unavailable = availability === "unavailable";
  const comingSoon = availability === "coming_soon";

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={onPreview}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition",
        unavailable && "cursor-not-allowed opacity-45",
        preview ? "bg-accent/12 ring-1 ring-accent/25" : active ? "bg-accent/8 ring-1 ring-accent/15" : !unavailable && "hover:bg-surface",
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: model.accent }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[12px] font-semibold text-foreground">{model.name}</span>
          {comingSoon && (
            <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-px text-[8px] font-semibold text-violet-700">
              Coming soon
            </span>
          )}
          {!comingSoon && model.id !== "automatic" ? (
            <CostTierTag costScore={model.ratings.cost} />
          ) : null}
          {active && !preview && <CheckCheck className="size-3 shrink-0 text-accent" strokeWidth={2} />}
        </div>
        <p className="mt-px truncate text-[10px] text-muted-foreground">{model.tagline}</p>
      </div>
    </button>
  );
}

interface DropdownPos {
  bottom?: number;
  top?: number;
  left: number;
  width: number;
  openUp: boolean;
}

export function ModelPicker({
  value,
  onChange,
  disabled,
  className,
  placement = "up",
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  placement?: "up" | "down" | "auto";
  compact?: boolean;
}) {
  const { profile } = useAuthStore();
  const creditsPlanId = useCreditsStore((s) => s.planId);
  const effectivePlan = normalizePlanId(profile?.plan_id ?? creditsPlanId ?? "free");
  const modelLocked = !canSelectModel(effectivePlan);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [pos, setPos] = React.useState<DropdownPos | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [providerStatus, setProviderStatus] = React.useState<ProviderAvailability | null>(null);
  const current =
    value === "automatic"
      ? AUTOMATIC_MODEL
      : (CREATION_MODELS.find((m) => m.id === value) ?? CREATION_MODELS[0]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    fetch("/api/ai/provider-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { providers?: ProviderAvailability } | null) => {
        if (json?.providers) setProviderStatus(json.providers);
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!providerStatus || value === "automatic") return;
    const m = CREATION_MODELS.find((x) => x.id === value);
    if (!m) return;
    if (modelAvailability(m, providerStatus) !== "ok") {
      onChange("automatic");
      toast.info("Selected model is temporarily unavailable. Switched to Automatic.");
    }
  }, [providerStatus, value, onChange]);

  const updatePos = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const totalHeight = PANEL_BODY_H + 42;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let openUp = placement === "up";
    if (placement === "auto") {
      openUp = spaceBelow < totalHeight && spaceAbove > spaceBelow;
    } else if (placement === "down") {
      openUp = false;
    }
    const listWidth = compact ? 220 : 248;
    const panelWidth = previewId ? listWidth + 248 : listWidth;
    setPos({
      openUp,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      top: openUp ? undefined : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - panelWidth - 8),
      width: panelWidth,
    });
  }, [placement, compact, previewId]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setPreviewId(null);
      return;
    }
    updatePos();
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, updatePos]);

  React.useEffect(() => {
    if (open) updatePos();
  }, [previewId, open, updatePos]);

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  const manualModels = query ? CREATION_MODELS : [...FLAGSHIP_MODELS, ...ADDITIONAL_MODELS];
  const filteredManual = sortModelsForPicker(
    manualModels.filter((m) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.specialization.toLowerCase().includes(q) ||
        m.tagline.toLowerCase().includes(q)
      );
    }),
    (m) => modelAvailability(m, providerStatus) === "coming_soon",
  );

  const showAutomatic = !query || "automatic".includes(query.toLowerCase()) || AUTOMATIC_MODEL.name.toLowerCase().includes(query.toLowerCase());

  const previewModel =
    previewId === "automatic"
      ? AUTOMATIC_MODEL
      : previewId
        ? CREATION_MODELS.find((m) => m.id === previewId)
        : null;

  function confirmModel(id: string) {
    if (id === "automatic") {
      onChange("automatic");
      setOpen(false);
      setPreviewId(null);
      return;
    }
    const m = CREATION_MODELS.find((x) => x.id === id);
    if (!m || modelAvailability(m, providerStatus) !== "ok") return;
    onChange(id);
    setOpen(false);
    setPreviewId(null);
  }

  const dropdown =
    pos && mounted
      ? createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={dropRef}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  ...(pos.openUp ? { bottom: pos.bottom } : { top: pos.top }),
                  left: pos.left,
                  width: pos.width,
                  zIndex: 9999,
                }}
                className="flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-background shadow-[0_20px_48px_-10px_rgba(0,0,0,0.22)] ring-1 ring-border"
                data-testid="model-picker-panel"
              >
                <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                  <Search className="size-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search models…"
                    className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>

                <div className="flex shrink-0" style={{ height: PANEL_BODY_H }}>
                  <div className="min-w-0 flex-1 overflow-y-auto p-1">
                    {showAutomatic && (
                      <>
                        <p className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Recommended
                        </p>
                        <ModelRow
                          model={AUTOMATIC_MODEL as CreationModel}
                          active={value === "automatic"}
                          preview={previewId === "automatic"}
                          availability="ok"
                          onPreview={() => setPreviewId("automatic")}
                        />
                      </>
                    )}
                    {filteredManual.length === 0 && !showAutomatic ? (
                      <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                        No models match &ldquo;{query}&rdquo;
                      </p>
                    ) : filteredManual.length > 0 ? (
                      <>
                        {!query && (
                          <p className="px-2 pb-1 pt-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Choose manually
                          </p>
                        )}
                        {filteredManual.map((m) => (
                          <ModelRow
                            key={m.id}
                            model={m}
                            active={m.id === value}
                            preview={m.id === previewId}
                            availability={modelAvailability(m, providerStatus)}
                            onPreview={() => setPreviewId(m.id)}
                          />
                        ))}
                      </>
                    ) : null}
                  </div>

                  <AnimatePresence>
                    {previewModel && (
                      <ModelSidePanel
                        model={previewModel as CreationModel}
                        active={previewModel.id === value}
                        availability={previewModel.id === "automatic" ? "ok" : modelAvailability(previewModel as CreationModel, providerStatus)}
                        onUse={() => confirmModel(previewModel.id)}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {!previewModel && (
                  <div className="shrink-0 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground/60">
                    Select a model to preview · confirm with Use
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  if (modelLocked) {
    return (
      <div className={cn("relative", className)} data-testid="model-selector-free">
        <button
          type="button"
          disabled
          title="Upgrade to choose a model"
          className="flex h-7 max-w-full cursor-default select-none items-center gap-1.5 rounded-md bg-surface px-2 text-[11px] font-medium text-muted-foreground ring-1 ring-border"
        >
          <Sparkles className="size-3 shrink-0 text-accent/70" strokeWidth={1.75} />
          <span className="truncate">Automatic — best model for this request</span>
          <Lock className="size-3 shrink-0 text-muted-foreground/40" strokeWidth={1.65} />
        </button>
      </div>
    );
  }

  const automatic = value === "automatic";
  const triggerLabel = automatic ? "Automatic" : current.name;

  return (
    <div className={cn("relative", className)} data-testid="model-selector-paid">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        title={automatic ? "Automatic — best model for this request" : "Choose model"}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md bg-surface px-2 text-[12px] font-medium text-foreground ring-1 ring-border transition hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          compact && "max-w-[180px] text-[11px]",
        )}
      >
        {automatic ? (
          <Sparkles className="size-3 shrink-0 text-accent/80" strokeWidth={1.75} />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: current.accent }} />
        )}
        <span className="truncate">{triggerLabel}</span>
        <ChevronUp
          className={cn("size-3 shrink-0 text-muted-foreground transition", open ? "" : "rotate-180")}
          strokeWidth={1.75}
        />
      </button>
      {dropdown}
    </div>
  );
}
