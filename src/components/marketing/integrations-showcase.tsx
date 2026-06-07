"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plug } from "lucide-react";
import { IntegrationIconWell } from "@/components/brand/integration-icons";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface IntegrationShowcaseItem {
  name: string;
  desc: string;
  slug: string;
  /** Tailwind gradient for center glow */
  glow: string;
  ring: string;
}

/** Player-visible integrations only — no model API keys (OpenAI, Gemini, etc.). */
export const INTEGRATION_SHOWCASE_ITEMS: IntegrationShowcaseItem[] = [
  {
    name: "Supabase",
    desc: "Database, Auth, Storage",
    slug: "supabase",
    glow: "from-[#3ECF8E]/35 via-[#3ECF8E]/10 to-transparent",
    ring: "ring-[#3ECF8E]/35",
  },
  {
    name: "Stripe",
    desc: "Payments & billing",
    slug: "stripe",
    glow: "from-[#635BFF]/35 via-[#635BFF]/10 to-transparent",
    ring: "ring-[#635BFF]/35",
  },
  {
    name: "GitHub",
    desc: "Source control & CI",
    slug: "github",
    glow: "from-[#2ea44f]/42 via-[#238636]/18 to-[#6e40c9]/10 dark:from-[#3fb950]/38 dark:via-[#238636]/16",
    ring: "ring-[#2ea44f]/40 dark:ring-[#3fb950]/45",
  },
  {
    name: "Vercel",
    desc: "Deploy & edge",
    slug: "vercel",
    glow: "from-[#0070F3]/40 via-[#000000]/16 to-transparent dark:from-[#3291ff]/36 dark:via-[#0070F3]/14",
    ring: "ring-[#0070F3]/42 dark:ring-[#3291ff]/48",
  },
  {
    name: "Resend",
    desc: "Transactional email",
    slug: "resend",
    glow: "from-[#FF6B35]/40 via-[#FF8C5A]/16 to-transparent dark:from-[#FF6B35]/34 dark:via-[#FF8C5A]/12",
    ring: "ring-[#FF6B35]/40 dark:ring-[#FF8C5A]/45",
  },
  {
    name: "Slack",
    desc: "Alerts & webhooks",
    slug: "slack",
    glow: "from-[#E01E5A]/30 via-[#36C5F0]/12 to-transparent",
    ring: "ring-[#36C5F0]/30",
  },
  {
    name: "Discord",
    desc: "Community hooks",
    slug: "discord",
    glow: "from-[#5865F2]/35 via-[#5865F2]/10 to-transparent",
    ring: "ring-[#5865F2]/35",
  },
  {
    name: "Firebase",
    desc: "Mobile auth & data",
    slug: "firebase",
    glow: "from-[#FFCA28]/30 via-[#FFA000]/12 to-transparent",
    ring: "ring-[#FFA000]/30",
  },
  {
    name: "Paddle",
    desc: "SaaS subscriptions",
    slug: "paddle",
    glow: "from-[#FDDD35]/28 via-[#FDDD35]/10 to-transparent",
    ring: "ring-[#FDDD35]/28",
  },
];

const LOOP_ITEMS = [...INTEGRATION_SHOWCASE_ITEMS, ...INTEGRATION_SHOWCASE_ITEMS];
/** Fixed gap between carousel slots (layout box — unaffected by scale). */
const CAROUSEL_SLOT_GAP_PX = 12;
const CAROUSEL_SLOT_WIDTH_PX = 136;

function ElectricPlugIcon() {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-accent/35 shadow-[0_0_24px_-6px_rgba(99,102,241,0.55)]">
      <div className="integration-electric-plug absolute inset-0 opacity-90" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]"
        aria-hidden
      />
      <Plug className="relative z-10 size-[18px] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)]" strokeWidth={2.25} />
    </div>
  );
}

function IntegrationCarouselTile({
  item,
  centerWeight,
}: {
  item: IntegrationShowcaseItem;
  centerWeight: number;
}) {
  const scale = 0.8 + centerWeight * 0.28;
  const lift = centerWeight * -10;

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-end"
      style={{
        width: CAROUSEL_SLOT_WIDTH_PX,
        transform: `translateY(${lift}px) scale(${scale})`,
        transformOrigin: "center bottom",
        transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className={cn(
          "relative flex w-full flex-col items-center gap-2 overflow-hidden rounded-2xl bg-background/80 px-3 py-3.5 ring-1 transition-shadow duration-300",
          "bg-gradient-to-b",
          item.glow,
          item.ring,
          centerWeight > 0.72 && "shadow-[0_20px_48px_-18px_rgba(30,107,255,0.45)]",
          centerWeight < 0.35 && "brightness-[0.92] saturate-[0.88]",
          centerWeight >= 0.35 && "brightness-100 saturate-100",
        )}
      >
        <IntegrationIconWell provider={item.slug} size="md" title={item.name} iconVariant="brand" />
        <div className="text-center">
          <p className="text-[12px] font-semibold tracking-tight text-foreground">{item.name}</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{item.desc}</p>
        </div>
      </div>
    </div>
  );
}

function IntegrationMarqueeRail() {
  const reduceMotion = useReducedMotion();
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = React.useState<number[]>([]);
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      setPhase((p) => p + dt * 0.028);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const children = Array.from(track.children) as HTMLElement[];
      const container = track.parentElement;
      if (!container || children.length === 0) return;
      const centerX = container.getBoundingClientRect().left + container.clientWidth / 2;
      const next = children.map((el) => {
        const r = el.getBoundingClientRect();
        const itemCenter = r.left + r.width / 2;
        const dist = Math.abs(itemCenter - centerX);
        const norm = Math.max(0, 1 - dist / (container.clientWidth * 0.38));
        return norm;
      });
      setOffsets(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    const id = window.setInterval(measure, 120);
    return () => {
      ro.disconnect();
      window.clearInterval(id);
    };
  }, [phase, reduceMotion]);

  return (
    <div className="relative overflow-hidden py-2">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-surface/95 to-transparent dark:from-background/90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-surface/95 to-transparent dark:from-background/90"
        aria-hidden
      />
      <div
        ref={trackRef}
        className={cn(
          "flex w-max items-end will-change-transform",
          reduceMotion ? "" : "animate-[integration-marquee_42s_linear_infinite]",
        )}
        style={{
          gap: CAROUSEL_SLOT_GAP_PX,
          ...(reduceMotion ? {} : { animationPlayState: "running" }),
        }}
      >
        {LOOP_ITEMS.map((item, i) => (
          <IntegrationCarouselTile
            key={`${item.slug}-${i}`}
            item={item}
            centerWeight={offsets[i] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}

export function IntegrationShowcaseGrid({
  className = "",
  dense = false,
}: {
  className?: string;
  dense?: boolean;
}) {
  if (!dense) {
    return (
      <div className={cn("overflow-hidden rounded-2xl bg-background/40 ring-1 ring-border/70", className)}>
        <IntegrationMarqueeRail />
      </div>
    );
  }

  return (
    <motion.div className={cn("flex flex-wrap gap-2", className)}>
      {INTEGRATION_SHOWCASE_ITEMS.map((intg, i) => (
        <motion.div
          key={intg.name}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.2 }}
          className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 ring-1 ring-border"
        >
          <IntegrationIconWell provider={intg.slug} size="sm" title={intg.name} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground">{intg.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{intg.desc}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function IntegrationShowcaseSection({ variant = "default" }: { variant?: "default" | "premium" }) {
  const premium = variant === "premium";
  return (
    <motion.section
      variants={variants.fadeUp}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-5xl"
      data-testid="integrations-showcase"
    >
      <motion.div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <motion.div className="flex items-center gap-3">
          <ElectricPlugIcon />
          <motion.div>
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Integrations</h2>
            <p className="text-[12px] text-muted-foreground">
              {premium
                ? "Wire data, payments, email, and deploy targets per app — connect after you publish."
                : "Connect services inside each app after you create it — overview only here."}
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
      <motion.div
        className={cn(
          "rounded-2xl p-3 backdrop-blur-sm sm:p-4",
          premium
            ? "border border-accent/15 bg-gradient-to-br from-accent/[0.06] via-surface/50 to-background shadow-[0_20px_50px_-24px_rgba(30,107,255,0.35)] ring-1 ring-border/80"
            : "bg-surface/50 ring-1 ring-border/80 dark:bg-surface/30",
        )}
      >
        <IntegrationShowcaseGrid />
      </motion.div>
    </motion.section>
  );
}
