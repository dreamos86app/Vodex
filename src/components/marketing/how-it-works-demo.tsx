"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MessageSquare,
  Shapes,
  Hammer,
  FileDiff,
  MonitorSmartphone,
  Globe,
  CheckCircle2,
  Sparkles,
  Copy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "describe", label: "Describe", icon: MessageSquare, accent: "hsl(var(--accent))" },
  { id: "shape", label: "Shape", icon: Shapes, accent: "hsl(262 83% 58%)" },
  { id: "build", label: "Build", icon: Hammer, accent: "hsl(199 89% 48%)" },
  { id: "review", label: "Review", icon: FileDiff, accent: "hsl(38 92% 50%)" },
  { id: "preview", label: "Preview", icon: MonitorSmartphone, accent: "hsl(152 69% 40%)" },
  { id: "publish", label: "Publish", icon: Globe, accent: "hsl(221 83% 53%)" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const ROTATE_MS = 3000;
const RESUME_AFTER_MS = 6000;
const PROMPT = "Build me a CRM for dentists";

function StepProgressRing({ active, color, reduce }: { active: boolean; color: string; reduce: boolean }) {
  if (reduce || !active) return null;
  return (
    <svg className="pointer-events-none absolute inset-1 size-[calc(100%-8px)] -rotate-90" viewBox="0 0 100 100" aria-hidden>
      <motion.circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: ROTATE_MS / 1000, ease: "linear" }}
      />
    </svg>
  );
}

function useTypingPrompt(active: boolean) {
  const reduce = useReducedMotion();
  const [text, setText] = React.useState(reduce ? PROMPT : "");
  const [badge, setBadge] = React.useState(!!reduce);

  React.useEffect(() => {
    if (reduce || !active) return;
    setText("");
    setBadge(false);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setText(PROMPT.slice(0, i));
      if (i >= PROMPT.length) {
        window.clearInterval(t);
        window.setTimeout(() => setBadge(true), 350);
      }
    }, 45);
    return () => window.clearInterval(t);
  }, [active, reduce]);

  return { text, badge, reduce: !!reduce };
}

function DescribeDemo({ active }: { active: boolean }) {
  const { text, badge, reduce } = useTypingPrompt(active);
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] via-background to-background p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-accent/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Your prompt</p>
        <p className="mt-2 min-h-[24px] text-[15px] font-medium leading-snug text-foreground">
          {text}
          {!reduce && text.length < PROMPT.length ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent" />
          ) : null}
        </p>
      </div>
      <AnimatePresence>
        {badge ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-400"
          >
            <CheckCircle2 className="size-4" />
            Build request detected — blueprint next
          </motion.div>
        ) : null}
      </AnimatePresence>
      <p className="text-[11px] text-muted-foreground">Questions stay in chat. No project or credits until you confirm build.</p>
    </div>
  );
}

function ShapeDemo() {
  const cards = [
    { label: "Routes", value: "/dashboard · /patients · /appointments", color: "from-blue-500/15" },
    { label: "Data model", value: "Patients · Visits · Notes", color: "from-violet-500/15" },
    { label: "Style", value: "Calm clinical · soft teal accents", color: "from-cyan-500/15" },
    { label: "Scope", value: "Scheduling + patient records", color: "from-emerald-500/15" },
  ];
  return (
    <div className="p-5 sm:p-6">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Approved blueprint</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn("rounded-xl border border-border/60 bg-gradient-to-br p-3.5 to-transparent", c.color)}
          >
            <p className="text-[10px] font-medium text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-[12px] font-semibold text-foreground">{c.value}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-lg bg-accent px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm">Approve blueprint</span>
        <span className="rounded-lg border border-border bg-background px-3.5 py-2 text-[11px] font-semibold text-foreground">Edit plan</span>
      </div>
    </div>
  );
}

function BuildDemo({ active }: { active: boolean }) {
  const tasks = [
    { label: "Planning routes and layout", message: "Mapping /dashboard · /patients · /appointments" },
    { label: "Writing app/dashboard/page.tsx", message: "Creating dashboard shell with stats cards" },
    { label: "Creating components", message: "Patient table · appointment list · filters" },
    { label: "Adding quality checks", message: "Responsive layout · empty states · accessibility" },
    { label: "Preparing preview", message: "Sandbox preview ready for review" },
  ];
  const [lit, setLit] = React.useState(0);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce || !active) return;
    setLit(0);
    let s = 0;
    const t = window.setInterval(() => {
      s += 1;
      setLit(s);
      if (s >= tasks.length) window.clearInterval(t);
    }, 650);
    return () => window.clearInterval(t);
  }, [active, reduce, tasks.length]);

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Build in progress</p>
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[9px] font-semibold text-accent">Live generation</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-white/90 via-background to-accent/[0.04] p-4 shadow-sm ring-1 ring-border/50 dark:from-white/[0.04]">
        <div className="space-y-2.5">
          {tasks.map((task, i) => {
            const done = i < lit;
            const current = i === lit - 1 || (lit === 0 && i === 0);
            return (
              <motion.div
                key={task.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "flex gap-3 rounded-xl border px-3 py-2.5 transition",
                  done ? "border-emerald-500/25 bg-emerald-500/[0.06]" : current ? "border-accent/30 bg-accent/[0.05]" : "border-border/50 bg-background/60",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    done ? "bg-emerald-500 text-white" : current ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? "✓" : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[11px] font-semibold", done || current ? "text-foreground" : "text-muted-foreground")}>
                    {task.label}
                  </p>
                  {(done || current) && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-0.5 text-[10px] text-muted-foreground"
                    >
                      {task.message}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        {lit >= tasks.length && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-400"
          >
            <CheckCircle2 className="size-4" />
            Build complete — ready for review
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ReviewDemo() {
  const reduce = useReducedMotion();
  const [acceptedAll, setAcceptedAll] = React.useState(reduce);

  return (
    <div className="p-5 sm:p-6">
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] to-background ring-1 ring-amber-500/15">
        <div className="border-b border-amber-500/15 bg-amber-500/[0.05] px-4 py-2.5">
          <p className="text-[12px] font-semibold text-foreground">Review AI changes</p>
          <p className="font-mono text-[10px] text-muted-foreground">components/patient-table.tsx · +24 −3</p>
        </div>
        <div className="space-y-1 p-3 font-mono text-[10px] leading-relaxed">
          <p className="text-emerald-600 dark:text-emerald-400">+ export function PatientTable() {"{"}</p>
          <p className="text-emerald-600 dark:text-emerald-400">+   const [filter, setFilter] = useState("")</p>
          <p className="text-red-500/80">−   // TODO: wire data</p>
        </div>
        <div className="flex flex-col gap-2 border-t border-amber-500/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <AnimatePresence mode="wait">
            {acceptedAll ? (
              <motion.p
                key="accepted"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
              >
                All changes accepted · Checkpoint saved before apply
              </motion.p>
            ) : (
              <motion.p key="pending" className="text-[10px] text-muted-foreground">
                Checkpoint saved · rollback available
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Accept</span>
            <span className="rounded-lg bg-destructive/10 px-3 py-1.5 text-[10px] font-semibold text-destructive">Reject</span>
            <button
              type="button"
              onClick={() => setAcceptedAll(true)}
              className="rounded-lg bg-accent/15 px-3 py-1.5 text-[10px] font-semibold text-accent transition hover:bg-accent/25"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DentistCrmPreviewMock() {
  return (
    <div className="flex min-h-[220px]">
      <aside className="hidden w-[88px] shrink-0 flex-col gap-1 border-r border-teal-500/10 bg-teal-500/[0.04] p-2 sm:flex">
        {[
          { label: "Dashboard", active: true },
          { label: "Patients", active: false },
          { label: "Calendar", active: false },
        ].map(({ label, active }) => (
          <div
            key={label}
            className={cn(
              "rounded-lg px-2 py-1.5 text-[8px] font-semibold",
              active ? "bg-teal-500/15 text-teal-700 dark:text-teal-300" : "text-muted-foreground",
            )}
          >
            {label}
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-foreground">SmileCare CRM</p>
          <Users className="size-3.5 text-teal-600" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Patients", val: "128" },
            { label: "Today", val: "14" },
            { label: "Follow-ups", val: "6" },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-xl bg-white/90 p-2 ring-1 ring-teal-500/10 dark:bg-white/5">
              <p className="text-[13px] font-bold tabular-nums text-foreground">{val}</p>
              <p className="text-[8px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-white/80 p-2 ring-1 ring-border/50 dark:bg-white/5">
          <p className="text-[9px] font-medium text-muted-foreground">Upcoming</p>
          {["Sarah M. · Cleaning 2:30 PM", "James R. · Consult 4:00 PM"].map((row) => (
            <p key={row} className="mt-1 truncate text-[10px] font-medium text-foreground">
              {row}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewDemo() {
  const [viewport, setViewport] = React.useState<"desktop" | "mobile">("desktop");
  return (
    <div className="space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["desktop", "mobile"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewport(v)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition",
              viewport === v ? "bg-accent text-white shadow-sm" : "bg-surface text-muted-foreground ring-1 ring-border",
            )}
          >
            {v}
          </button>
        ))}
        <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">Preview ready</span>
        <span className="ml-auto rounded-lg bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent">Quality 91</span>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-accent/[0.05] via-background to-violet-500/[0.04] shadow-lg ring-1 ring-accent/10 transition-all",
          viewport === "mobile" ? "mx-auto max-w-[280px]" : "max-w-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/50 bg-background/80 px-3 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-accent" />
            <span className="text-[10px] font-semibold text-foreground">DreamOS86 builder</span>
          </div>
          <span className="text-[9px] text-muted-foreground">Sandbox · no deploy claim</span>
        </div>
        <div className="grid min-h-[220px] sm:grid-cols-[minmax(0,38%)_1fr]">
          <aside className="hidden border-r border-border/50 bg-background/70 p-2.5 sm:block">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Conversation</p>
            <div className="mt-2 space-y-2">
              <div className="rounded-lg bg-muted/60 px-2 py-1.5 text-[9px] text-foreground">Build the dentist CRM dashboard</div>
              <div className="rounded-lg bg-accent/10 px-2 py-1.5 text-[9px] text-accent">Added patients table + appointments</div>
            </div>
          </aside>
          <div className="p-2.5">
            <div className="overflow-hidden rounded-xl border border-border/50 bg-white/90 shadow-inner dark:bg-[#12141c]/90">
              <DentistCrmPreviewMock />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishDemo() {
  const reduce = useReducedMotion();
  const [published, setPublished] = React.useState(reduce);
  const publicUrl = "https://dreamos86.com/p/dentist-crm";

  React.useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setPublished(true), 2000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-accent/[0.06] via-background to-violet-500/[0.04] p-4 ring-1 ring-accent/10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            Preview ready
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Path mode
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Globe className="size-4 shrink-0 text-accent" />
          <span className="min-w-0 truncate font-mono text-[13px] font-semibold text-accent">{publicUrl}</span>
          <button type="button" className="ml-auto flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent" aria-label="Copy">
            <Copy className="size-3.5" />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Public path URL on dreamos86.com — custom subdomains available when DNS is connected.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <motion.span
          animate={published && !reduce ? { scale: [1, 1.04, 1] } : undefined}
          transition={{ duration: 0.45 }}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-[11px] font-semibold text-white shadow-md"
        >
          Publish app
        </motion.span>
        <span className="rounded-lg border border-border px-4 py-2 text-[11px] font-semibold text-muted-foreground">Copy link</span>
      </div>
    </div>
  );
}

export function HowItWorksDemo() {
  const reduce = useReducedMotion();
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const resumeRef = React.useRef<number | null>(null);

  const scheduleResume = React.useCallback(() => {
    if (resumeRef.current) window.clearTimeout(resumeRef.current);
    resumeRef.current = window.setTimeout(() => setPaused(false), RESUME_AFTER_MS);
  }, []);

  const onStepClick = (i: number) => {
    setActive(i);
    setPaused(true);
    scheduleResume();
  };

  React.useEffect(() => {
    if (reduce || paused) return;
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % STEPS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [reduce, paused]);

  React.useEffect(
    () => () => {
      if (resumeRef.current) window.clearTimeout(resumeRef.current);
    },
    [],
  );

  const step = STEPS[active];

  return (
    <section data-testid="how-it-works-demo" className="mx-auto mt-20 max-w-5xl px-4 sm:px-0">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">How it works</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground sm:text-[32px]">From idea to live app</h2>
        <p className="mx-auto mt-2 max-w-xl text-[14px] text-muted-foreground">
          A guided workflow that keeps you in control from the first prompt to the final preview.
        </p>
      </div>

      <div
        className="mt-10 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {STEPS.map((s, i) => {
          const isActive = i === active;
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`how-step-${s.id}`}
              aria-current={isActive ? "step" : undefined}
              onClick={() => onStepClick(i)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-center transition-all duration-300",
                isActive
                  ? "scale-[1.02] border-accent/40 bg-accent/10 shadow-[0_8px_32px_-12px_hsl(var(--accent)/0.45)]"
                  : "border-border/60 bg-background/70 hover:border-accent/25 hover:bg-accent/[0.03]",
              )}
            >
              <StepProgressRing active={isActive} color={s.accent} reduce={!!reduce} />
              <s.icon
                className={cn("relative size-5 transition-colors", isActive ? "text-accent" : "text-muted-foreground")}
                style={isActive ? { color: s.accent } : undefined}
                strokeWidth={1.75}
              />
              <span className={cn("relative text-[11px] font-semibold sm:text-[12px]", isActive ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="relative mt-8 overflow-hidden rounded-[20px] border border-border/60 bg-gradient-to-b from-background via-surface/40 to-background p-1 shadow-[0_40px_80px_-48px_hsl(var(--accent)/0.35)] ring-1 ring-accent/10"
        style={{ boxShadow: `0 40px 80px -48px ${step.accent}55` }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: `radial-gradient(ellipse 85% 55% at 50% 0%, ${step.accent}20, transparent 72%)` }}
        />
        <div className="relative min-h-[280px] overflow-hidden rounded-[16px] bg-background/95 backdrop-blur-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {step.id === "describe" ? (
                <DescribeDemo active={!paused || !!reduce} />
              ) : step.id === "build" ? (
                <BuildDemo active />
              ) : step.id === "shape" ? (
                <ShapeDemo />
              ) : step.id === "review" ? (
                <ReviewDemo />
              ) : step.id === "preview" ? (
                <PreviewDemo />
              ) : (
                <PublishDemo />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
