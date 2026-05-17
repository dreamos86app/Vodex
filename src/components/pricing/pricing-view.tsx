"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Zap, CreditCard, X, Bell, Sparkles,
  ChevronDown, Infinity as InfinityIcon, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

// ─── Plan data ────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  price: number | null;
  priceSuffix?: string;
  tagline: string;
  highlight?: boolean;
  features: string[];
  notIncluded?: string[];
  badge?: string;
  models: string;
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "Start building for free. No card required.",
    models: "Fast models (auto-selected)",
    features: [
      "Starter orchestration capacity",
      "3 active projects",
      "Discuss mode",
      "Public deployments",
    ],
    notIncluded: ["Premium models", "Custom domains", "Build mode", "Team access"],
    cta: "Get started free",
  },
  {
    id: "starter",
    name: "Starter",
    price: 20,
    tagline: "For individuals shipping real products.",
    models: "Standard + Premium models",
    features: [
      "Full orchestration capacity",
      "Unlimited projects",
      "Discuss, Edit & Build modes",
      "Premium AI models",
      "Custom domains",
      "Remove watermark",
      "Full source code export",
      "Email support",
    ],
    cta: "Get Starter",
  },
  {
    id: "pro",
    name: "Pro",
    price: 50,
    tagline: "For teams building production apps.",
    highlight: true,
    badge: "Most Popular",
    models: "All models including Opus & GPT-5.5",
    features: [
      "Advanced orchestration capacity",
      "Unlimited projects",
      "All frontier models (Opus 4, GPT-5.5, Gemini Pro)",
      "Multi-agent orchestration",
      "Production-scale infrastructure",
      "Unlimited custom domains",
      "5 collaborators",
      "Advanced analytics",
      "API access",
      "Priority support",
    ],
    cta: "Get Pro",
  },
  {
    id: "infinity",
    name: "Infinity",
    price: 100,
    priceSuffix: "from",
    tagline: "Orchestration-scale AI for power users & teams.",
    models: "All models + Ultra orchestration",
    features: [
      "Maximum orchestration depth",
      "Unlimited everything",
      "Ultra models + orchestration pipelines",
      "Unlimited collaborators",
      "Dedicated compute",
      "Custom SLAs",
      "White-label",
      "SSO / SAML",
      "Volume scaling with progressive discounts",
    ],
    cta: "Get Infinity",
  },
];

// Infinity sub-tiers — perfectly clean $100 / 2.5k intervals.
// Simple, predictable, enterprise-feeling.
// Always display compact (2.5k, 5k, 7.5k…) — never raw integers.
const INFINITY_TIERS = [
  { label: "Infinity I",    price: 100, credits: 2500,  display: "2.5k" },
  { label: "Infinity II",   price: 200, credits: 5000,  display: "5k" },
  { label: "Infinity III",  price: 300, credits: 7500,  display: "7.5k" },
  { label: "Infinity IV",   price: 400, credits: 10000, display: "10k" },
  { label: "Infinity V",    price: 500, credits: 12500, display: "12.5k" },
  { label: "Infinity VI",   price: 600, credits: 15000, display: "15k" },
  { label: "Infinity VII",  price: 700, credits: 17500, display: "17.5k" },
  { label: "Infinity VIII", price: 800, credits: 20000, display: "20k" },
];

// ─── Payments coming soon modal ───────────────────────────────────────────────

function PaymentsComingSoonModal({ planName, onClose }: { planName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] bg-background shadow-2xl ring-1 ring-border"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-accent/10">
              <CreditCard className="size-5 text-accent" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground">{planName} — Coming Soon</p>
              <p className="text-[12px] text-muted-foreground">Payments launching soon</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition hover:bg-surface hover:text-foreground"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            DreamOS86 is in early access. Paid plans are being finalized and will launch shortly.
            You&apos;ll receive an email the moment billing goes live.
          </p>
          <button
            onClick={onClose}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-accent/90 active:scale-[0.98]"
          >
            <Bell className="size-3.5" strokeWidth={2} />
            Got it — I&apos;ll wait
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onSelect,
  currentPlanId,
}: {
  plan: Plan;
  onSelect: (planId: string) => void;
  currentPlanId?: string;
}) {
  const isCurrent = currentPlanId === plan.id || (plan.id === "free" && !currentPlanId);
  const isInfinity = plan.id === "infinity";
  const [tierOpen, setTierOpen] = React.useState(false);
  const [selectedTier, setSelectedTier] = React.useState(0);
  const tierRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!tierOpen) return;
    function handler(e: MouseEvent) {
      if (tierRef.current && !tierRef.current.contains(e.target as Node)) setTierOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tierOpen]);

  const displayPrice = isInfinity ? INFINITY_TIERS[selectedTier].price : plan.price;

  return (
    <motion.div
      variants={variants.fadeUp}
      className={cn(
        "relative flex flex-col rounded-[var(--radius-2xl)] p-5 ring-1 transition",
        plan.highlight
          ? "bg-accent/5 ring-accent/35 shadow-[0_0_0_4px_hsl(var(--accent)/0.06)]"
          : "bg-surface ring-border",
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-0.5 text-[10.5px] font-semibold text-white">
          {plan.badge}
        </span>
      )}

      {/* Name + tagline */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">{plan.name}</h3>
          {isInfinity && <InfinityIcon className="size-4 text-accent" strokeWidth={1.75} />}
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-4">
        {plan.price === 0 ? (
          <p className="text-[28px] font-semibold tracking-tight text-foreground">Free</p>
        ) : (
          <div className="flex items-baseline gap-1">
            {plan.priceSuffix && (
              <span className="text-[11px] text-muted-foreground mr-0.5">{plan.priceSuffix}</span>
            )}
            <span className="text-[28px] font-semibold tracking-tight text-foreground">
              ${displayPrice}
            </span>
            <span className="text-[12px] text-muted-foreground">/mo</span>
          </div>
        )}
      </div>

      {/* Infinity tier selector */}
      {isInfinity && (
        <div ref={tierRef} className="relative mb-4">
          <button
            type="button"
            onClick={() => setTierOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-background px-3 py-2 text-[12px] ring-1 ring-border transition hover:ring-accent/40"
          >
            <div className="flex items-center gap-1.5">
              <Zap className="size-3.5 text-accent" strokeWidth={1.75} />
              <span className="font-medium text-foreground">{INFINITY_TIERS[selectedTier].label}</span>
              <span className="text-muted-foreground">— {INFINITY_TIERS[selectedTier].display} orchestration units</span>
            </div>
            <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", tierOpen && "rotate-180")} strokeWidth={1.75} />
          </button>
          <AnimatePresence>
            {tierOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl bg-background shadow-lg ring-1 ring-border"
              >
                {INFINITY_TIERS.map((t, i) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => { setSelectedTier(i); setTierOpen(false); }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition hover:bg-surface",
                      selectedTier === i && "bg-surface",
                    )}
                  >
                    <span className="font-medium text-foreground">{t.label}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{t.display} units</span>
                      <span className="font-semibold text-foreground">${t.price}/mo</span>
                    </div>
                  </button>
                ))}
                <div className="border-t border-border px-3 py-2.5">
                  <a
                    href="mailto:dreamos86app@gmail.com?subject=Enterprise inquiry"
                    className="flex items-center gap-1.5 text-[11.5px] text-accent hover:underline underline-offset-2"
                  >
                    <Mail className="size-3.5" strokeWidth={1.75} />
                    Need larger scale? Contact us
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Models label */}
      <div className="mb-4 flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-border/60">
        <Sparkles className="size-3 shrink-0 text-accent" strokeWidth={1.75} />
        {plan.models}
      </div>

      {/* CTA */}
      {isCurrent ? (
        <div className="mb-5 flex items-center justify-center rounded-xl bg-muted/40 py-2.5 text-[12.5px] font-medium text-muted-foreground ring-1 ring-border">
          Current plan
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(plan.id)}
          className={cn(
            "mb-5 flex w-full cursor-pointer items-center justify-center rounded-xl py-2.5 text-[13px] font-semibold transition active:scale-[0.98]",
            plan.highlight
              ? "bg-accent text-white shadow-[0_2px_12px_hsl(var(--accent)/0.35)] hover:bg-accent/90"
              : plan.id === "free"
                ? "bg-surface text-foreground ring-1 ring-border hover:ring-accent/40 hover:bg-background"
                : "bg-foreground text-background hover:opacity-90",
          )}
        >
          {plan.cta}
        </button>
      )}

      <div className="h-px bg-border" />

      {/* Features */}
      <ul className="mt-4 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12.5px] text-foreground/80">
            <Check className="mt-0.5 size-3.5 shrink-0 text-positive" strokeWidth={2.5} />
            {f}
          </li>
        ))}
        {plan.notIncluded?.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-muted-foreground/45 line-through">
            <X className="mt-0.5 size-3.5 shrink-0 opacity-30" strokeWidth={2} />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ─── Main pricing view ────────────────────────────────────────────────────────

export function PricingView() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [comingSoonPlan, setComingSoonPlan] = React.useState<string | null>(null);

  function handleSelect(planId: string) {
    if (planId === "free") {
      if (!profile) router.push("/auth/signup");
      return;
    }
    if (!profile) { router.push("/auth/signup"); return; }
    const labels: Record<string, string> = {
      starter: "Starter",
      pro: "Pro",
      business: "Business",
      infinity: "Infinity",
    };
    setComingSoonPlan(labels[planId] ?? planId);
  }

  return (
    <>
      <motion.div
        variants={variants.staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl space-y-10 pb-16"
      >
        {/* Header */}
        <motion.div variants={variants.fadeUp} className="text-center">
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
            Choose your plan
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Credits scale dynamically with your usage. No hidden fees. Cancel anytime.
          </p>
        </motion.div>

        {/* 4 plan cards in one row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelect={handleSelect}
              currentPlanId={profile?.plan_id}
            />
          ))}
        </div>

        {/* FAQ */}
        <motion.div variants={variants.fadeUp} className="space-y-4">
          <h3 className="text-[15px] font-semibold text-foreground">Common questions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                q: "What are credits?",
                a: "Credits represent AI compute value. Each request costs credits based on the model selected, context size, and complexity. All costs are calculated transparently.",
              },
              {
                q: "Do unused credits roll over?",
                a: "No. Credits reset monthly to keep pricing predictable. Your projects and data are never affected.",
              },
              {
                q: "Can I change my plan mid-cycle?",
                a: "Yes. Upgrades are immediate and pro-rated. Downgrades take effect at the next billing period.",
              },
              {
                q: "What's the 5% savings on Infinity?",
                a: "All Infinity tiers above $300/mo automatically receive a 5% volume discount, with price steps increasing by $150 from Infinity IV onward.",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-[var(--radius-lg)] bg-surface px-5 py-4 ring-1 ring-border">
                <p className="text-[13px] font-semibold text-foreground">{faq.q}</p>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {comingSoonPlan && (
          <PaymentsComingSoonModal
            planName={comingSoonPlan}
            onClose={() => setComingSoonPlan(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
