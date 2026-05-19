"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Shield, Zap, Rocket, X, Layers, Cpu, Gauge } from "lucide-react";
import { IntegrationShowcaseSection } from "@/components/marketing/integrations-showcase";
import {
  PublicMarketingFooter,
  PublicMarketingHeader,
} from "@/components/marketing/public-marketing-shell";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function PublicAuthModal({
  open,
  onClose,
  draft,
  onDraftChange,
}: {
  open: boolean;
  onClose: () => void;
  draft: string;
  onDraftChange: (v: string) => void;
}) {
  const nextCreate =
    draft.trim().length > 0
      ? `/create?prompt=${encodeURIComponent(draft.trim())}`
      : "/create";
  const signupHref = `/auth/signup?next=${encodeURIComponent(nextCreate)}`;
  const loginHref = `/auth/login?next=${encodeURIComponent(nextCreate)}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10040] flex items-end justify-center bg-foreground/40 p-4 backdrop-blur-md sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
            <p className="pr-10 text-[15px] font-semibold text-foreground">Sign in to build</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Save projects, chat with models, and publish — same home page, unlocked after you sign in.
            </p>
            <label htmlFor="auth-gate-prompt" className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Your idea (optional)
            </label>
            <textarea
              id="auth-gate-prompt"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={3}
              placeholder="e.g. A calm habit tracker with streaks and charts…"
              className="mt-1.5 w-full resize-none rounded-xl border border-border/80 bg-surface/60 px-3 py-2 text-[13px] text-foreground outline-none transition focus-visible:border-accent/40 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" size="md" asChild>
                <Link href={loginHref}>Log in</Link>
              </Button>
              <Button variant="accent" size="md" asChild>
                <Link href={signupHref} className="gap-2">
                  Get Started
                  <ArrowRight className="size-3.5" strokeWidth={2} />
                </Link>
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CapabilityCards() {
  const items = [
    {
      icon: Layers,
      title: "Real project files",
      desc: "Routes, components, and schemas land in a saved app — not a disposable demo.",
      hue: "from-accent/15 to-violet-500/10",
    },
    {
      icon: Cpu,
      title: "Multi-model workspace",
      desc: "Discuss, edit surgically, or run full builds with clear token costs.",
      hue: "from-sky-500/12 to-accent/10",
    },
    {
      icon: Gauge,
      title: "Honest publish paths",
      desc: "Web hosting on your subdomain first; mobile queues only when your plan and builder allow it.",
      hue: "from-emerald-500/10 to-cyan-500/8",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, duration: 0.4 }}
      className="mx-auto mt-16 max-w-5xl"
    >
      <motion.div className="grid gap-4 sm:grid-cols-3">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.06 }}
            whileHover={{ y: -3 }}
            className={cn(
              "relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br p-5 text-left shadow-sm ring-1 ring-border/50",
              it.hue,
            )}
          >
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-background/80 ring-1 ring-border/60">
              <it.icon className="size-4 text-accent" strokeWidth={1.65} />
            </div>
            <p className="text-[14px] font-semibold text-foreground">{it.title}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{it.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}

function ShipFasterSection() {
  const cards = [
    {
      title: "Build apps in minutes",
      desc: "Describe what you want. DreamOS86 writes real files into a saved project you can open, edit, and ship.",
      accent: "from-accent/20 via-accent/5 to-transparent",
    },
    {
      title: "One workspace, three modes",
      desc: "Discuss architecture, edit surgically, or run full builds — each mode uses tokens only after successful AI steps.",
      accent: "from-violet-500/15 via-sky-500/5 to-transparent",
    },
    {
      title: "Production-ready by default",
      desc: "Supabase auth, Stripe billing hooks, and publish readiness checks — no fake deploy buttons.",
      accent: "from-emerald-500/12 via-cyan-500/5 to-transparent",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.45 }}
      className="mx-auto mt-20 max-w-5xl text-center"
    >
      <h2 className="text-balance text-[26px] font-semibold tracking-tight text-foreground sm:text-[32px]">
        Now you can ship software within minutes — not months
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        DreamOS86 is an AI-native workspace: one prompt becomes a hosted preview, saved files, and a path to publish when you are ready.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            whileHover={{ y: -4 }}
            className={cn(
              "rounded-2xl border border-border/70 bg-gradient-to-br p-6 text-left shadow-sm ring-1 ring-border/50",
              card.accent,
            )}
          >
            <p className="text-[15px] font-semibold text-foreground">{card.title}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{card.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function BottomCta() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.22, duration: 0.4 }}
      className="mx-auto mt-16 flex max-w-lg flex-col items-center gap-4 text-center"
    >
      <p className="text-[15px] font-semibold text-foreground">Ready to build?</p>
      <motion.div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-md transition hover:bg-accent/90"
        >
          Start building
          <ArrowRight className="size-3.5" strokeWidth={2} />
        </Link>
        <Link
          href="/auth/login?next=/chat"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-[13px] font-semibold text-foreground transition hover:bg-surface"
        >
          Try AI Chat
        </Link>
      </motion.div>
    </motion.section>
  );
}

export function PublicLanding() {
  const [draft, setDraft] = React.useState("");
  const [authOpen, setAuthOpen] = React.useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PublicAuthModal open={authOpen} onClose={() => setAuthOpen(false)} draft={draft} onDraftChange={setDraft} />

      <PublicMarketingHeader />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(var(--accent)/0.22),transparent_70%)]"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="size-3.5" strokeWidth={2} /> AI-native app OS
          </p>
          <h1 className="mt-5 text-balance text-[32px] font-semibold tracking-tight text-foreground sm:text-[42px]">
            Describe software. DreamOS86 builds the UI, logic, and files — then hosts it for you.
          </h1>
          <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
            One workspace for planning, multi-model chat, real saved projects, and honest publish paths — web on{" "}
            <span className="font-medium text-foreground">your-app.dreamos86.com</span>, mobile packaging when your plan
            and builder are ready.
          </p>

          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-accent/20 bg-gradient-to-b from-accent/[0.08] to-background p-1 shadow-[0_24px_64px_-28px_rgba(30,107,255,0.35)] ring-1 ring-border/80">
            <div className="rounded-[14px] bg-background/95 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="w-full cursor-pointer text-left"
              >
                <label htmlFor="public-hero-prompt-ro" className="sr-only">
                  Describe what you want to build — sign in to continue
                </label>
                <div
                  id="public-hero-prompt-ro"
                  className="w-full rounded-xl border border-border/70 bg-surface/60 px-3 py-2.5 text-left text-[13px] leading-relaxed text-muted-foreground ring-0 transition hover:border-accent/30"
                >
                  {draft.trim()
                    ? draft
                    : "Sign in to describe what you want to build — tap here to open login or sign up…"}
                </div>
              </button>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold shadow-sm transition",
                    "bg-accent text-white hover:bg-accent/90",
                  )}
                >
                  <Zap className="size-3.5" strokeWidth={2} />
                  Continue — log in or sign up
                  <ArrowRight className="size-3.5 opacity-80" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="size-3.5 text-accent" strokeWidth={1.75} /> Your data, your Supabase workspace
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Rocket className="size-3.5 text-accent" strokeWidth={1.75} /> Tokens only after successful AI steps
            </span>
          </div>
        </motion.section>

        <CapabilityCards />

        <ShipFasterSection />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <IntegrationShowcaseSection variant="premium" />
        </motion.div>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.16, duration: 0.35 }}
          className="mx-auto mt-14 max-w-4xl rounded-2xl border border-border/70 bg-gradient-to-br from-accent/[0.06] via-background to-violet-500/[0.05] p-6 text-center ring-1 ring-border/60 sm:p-10"
        >
          <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Flow</p>
          <p className="mt-2 text-balance text-[18px] font-semibold text-foreground sm:text-[22px]">
            Idea → saved app → hosted preview → publish when you&apos;re ready
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Every step writes to your workspace. Nothing pretends to deploy — you always see what actually happened.
          </p>
        </motion.section>

        <BottomCta />

        <p className="mx-auto mt-10 max-w-lg text-center text-[14px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-accent hover:underline underline-offset-2">
            Log in
          </Link>
        </p>
        <p className="mx-auto mt-6 max-w-lg text-center text-[11px] text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="hover:underline underline-offset-4">
            Terms
          </Link>{" "}
          and acknowledge our{" "}
          <Link href="/privacy" className="hover:underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
      <PublicMarketingFooter />
    </div>
  );
}
