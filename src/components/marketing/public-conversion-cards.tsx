"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { MessageSquare, Layers, ShieldCheck, Rocket, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMPT = "Build me a CRM for dentists";
const BUILD_STAGES = ["Plan", "Screens", "Logic", "Quality"] as const;

function TypingPromptPreview({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [text, setText] = React.useState(reduce ? PROMPT : "");
  const [detected, setDetected] = React.useState(reduce);

  React.useEffect(() => {
    if (reduce || !active) return;
    setText("");
    setDetected(false);
    let i = 0;
    const type = window.setInterval(() => {
      i += 1;
      setText(PROMPT.slice(0, i));
      if (i >= PROMPT.length) {
        window.clearInterval(type);
        window.setTimeout(() => setDetected(true), 400);
      }
    }, 55);
    return () => window.clearInterval(type);
  }, [active, reduce]);

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-border/70 bg-background/90 p-3 ring-1 ring-border/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prompt</p>
      <p className="min-h-[18px] font-mono text-[11px] text-foreground">
        {text}
        {!reduce && active && text.length < PROMPT.length ? (
          <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-accent" />
        ) : null}
      </p>
      <AnimatePresence>
        {detected ? (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive ring-1 ring-positive/20"
          >
            <CheckCircle2 className="size-3" />
            App request detected
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BuildStagesPreview({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [lit, setLit] = React.useState(reduce ? BUILD_STAGES.length : 0);

  React.useEffect(() => {
    if (reduce || !active) return;
    setLit(0);
    let step = 0;
    const t = window.setInterval(() => {
      step += 1;
      setLit(step);
      if (step >= BUILD_STAGES.length) window.clearInterval(t);
    }, 700);
    return () => window.clearInterval(t);
  }, [active, reduce]);

  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {BUILD_STAGES.map((s, i) => (
        <motion.span
          key={s}
          animate={{ opacity: i < lit ? 1 : 0.35, scale: i < lit ? 1 : 0.96 }}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition-colors",
            i < lit ? "bg-accent/15 text-accent ring-accent/30" : "bg-muted text-muted-foreground ring-border",
          )}
        >
          {s}
        </motion.span>
      ))}
    </div>
  );
}

function DiffPreview() {
  const reduce = useReducedMotion();
  const [acceptedAll, setAcceptedAll] = React.useState(reduce);

  React.useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setAcceptedAll(true), 2200);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 ring-1 ring-amber-500/10">
      <p className="font-mono text-[10px] text-muted-foreground">dashboard.tsx +12 −2</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-positive/15 px-2 py-0.5 text-[10px] font-semibold text-positive">Accept</span>
        <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Reject</span>
        <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">Accept all</span>
      </div>
      <AnimatePresence>
        {acceptedAll ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-[10px] font-medium text-positive"
          >
            All changes accepted · Checkpoint saved before apply
          </motion.p>
        ) : (
          <p className="mt-1.5 text-[10px] text-muted-foreground">Checkpoint saved · rollback available</p>
        )}
      </AnimatePresence>
    </div>
  );
}

function PublishPreview() {
  const reduce = useReducedMotion();
  const [published, setPublished] = React.useState(reduce);
  const publicUrl = "https://dreamos86.com/p/dentist-crm";

  React.useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setPublished(true), 1800);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <div className="mt-4 space-y-2.5 rounded-xl border border-border/70 bg-gradient-to-br from-accent/[0.06] via-background to-violet-500/[0.04] p-3 ring-1 ring-accent/15">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-positive/15 px-2 py-0.5 text-[10px] font-semibold text-positive">Preview ready</span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Path mode
        </span>
      </div>
      <p className="truncate font-mono text-[10px] font-semibold text-accent">{publicUrl}</p>
      <div className="flex flex-wrap gap-1.5">
        <motion.button
          type="button"
          animate={published && !reduce ? { scale: [1, 1.03, 1] } : undefined}
          transition={{ duration: 0.4 }}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm"
        >
          Publish app
        </motion.button>
        <button type="button" className="rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-semibold text-foreground">
          Copy link
        </button>
      </div>
    </div>
  );
}

const CARDS = [
  {
    icon: MessageSquare,
    title: "Describe it like a message",
    body: "Turn a simple idea into a real app plan. No setup, no technical wording, no blank project.",
    accent: "from-sky-500/15 to-accent/5",
    Preview: TypingPromptPreview,
  },
  {
    icon: Layers,
    title: "Watch the app take shape",
    body: "DreamOS86 builds in visible stages: structure, screens, logic, quality checks, and preview.",
    accent: "from-violet-500/15 to-indigo-500/5",
    Preview: BuildStagesPreview,
  },
  {
    icon: ShieldCheck,
    title: "Stay in control",
    body: "Review the blueprint, stop anytime, accept or reject changes, and continue where you left off.",
    accent: "from-emerald-500/15 to-teal-500/5",
    Preview: () => <DiffPreview />,
  },
  {
    icon: Rocket,
    title: "Launch when it's ready",
    body: "Preview, polish, publish, or export — DreamOS86 only shows real ready states, never fake deploys.",
    accent: "from-amber-500/15 to-orange-500/5",
    Preview: () => <PublishPreview />,
  },
] as const;

export function PublicConversionCards() {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = React.useState<number | null>(null);

  return (
    <section
      data-testid="public-conversion-cards"
      className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2"
    >
      {CARDS.map((card, i) => {
        const active = hovered === i;

        return (
          <motion.article
            key={card.title}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border/70 bg-background/80 p-5",
              "shadow-sm ring-1 ring-border/50 transition duration-300",
              "hover:border-accent/30 hover:shadow-[0_24px_56px_-28px_hsl(var(--accent)/0.35)]",
              "focus-within:border-accent/30 focus-within:ring-accent/20",
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 opacity-50 transition group-hover:opacity-100",
                "bg-gradient-to-br",
                card.accent,
              )}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-accent/10 blur-2xl"
              animate={reduce || !active ? { opacity: 0.3 } : { opacity: 0.7, scale: [1, 1.08, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="relative flex gap-4">
              <motion.div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background/90 ring-1 ring-border/80 shadow-sm"
                animate={reduce ? undefined : active ? { y: -2 } : { y: 0 }}
              >
                <card.icon className="size-5 text-accent" strokeWidth={1.75} />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{card.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{card.body}</p>
                {i === 0 ? (
                  <TypingPromptPreview active={active || !!reduce} />
                ) : i === 1 ? (
                  <BuildStagesPreview active={active || !!reduce} />
                ) : i === 2 ? (
                  <DiffPreview />
                ) : (
                  <PublishPreview />
                )}
              </div>
            </div>
            <Sparkles
              className={cn(
                "pointer-events-none absolute bottom-3 right-3 size-3.5 text-accent/40 transition",
                active && "text-accent/70",
              )}
              strokeWidth={1.75}
            />
          </motion.article>
        );
      })}
    </section>
  );
}
