"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Check, Sparkles, Building,
  Users, Loader2, MessageCircle, Pencil, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { variants, transition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

const USE_CASES = [
  { id: "saas", label: "SaaS Product", icon: Building, desc: "Build a commercial software product" },
  { id: "personal", label: "Personal Project", icon: Sparkles, desc: "Explore ideas and experiment" },
  { id: "client", label: "Client Work", icon: Users, desc: "Build apps for clients" },
  { id: "team", label: "Team Workspace", icon: Users, desc: "Internal tools for your team" },
];

const EXPERIENCE_LEVELS = [
  { id: "beginner", label: "Beginner", desc: "New to building apps" },
  { id: "intermediate", label: "Intermediate", desc: "Comfortable with code" },
  { id: "advanced", label: "Advanced", desc: "Experienced developer" },
];

const MODELS = [
  { id: "claude-3-5-sonnet", label: "Claude Sonnet", desc: "Best for most tasks, fast and smart" },
  { id: "gpt-4o", label: "GPT-4o", desc: "Great for code and reasoning" },
  { id: "gemini-2-0-flash", label: "Gemini Flash", desc: "Fast and efficient" },
];

const TOTAL_STEPS = 5;

const MODES_INTRO = [
  {
    id: "discuss",
    icon: MessageCircle,
    label: "Discuss",
    accent: "text-blue-500 bg-blue-500/10 ring-blue-500/25",
    desc: "Talk with your AI architect. Shape ideas, explore trade-offs, plan architecture — before a single line is written.",
  },
  {
    id: "edit",
    icon: Pencil,
    label: "Edit",
    accent: "text-amber-500 bg-amber-500/10 ring-amber-500/25",
    desc: "Surgical precision. Target a specific component, route, schema, or flow for a focused AI modification.",
  },
  {
    id: "build",
    icon: Zap,
    label: "Build",
    accent: "text-violet-500 bg-violet-500/10 ring-violet-500/25",
    desc: "Full system generation. Describe your app and DreamOS86 builds routes, UI, database, auth, and APIs — all at once.",
  },
];

export function OnboardingView() {
  const router = useRouter();
  const { profile, setProfile } = useAuthStore();
  const [step, setStep] = React.useState(1);
  const [workspaceName, setWorkspaceName] = React.useState(
    profile?.full_name ? `${profile.full_name}'s Workspace` : "",
  );
  const [useCase, setUseCase] = React.useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = React.useState<string | null>(null);
  const [preferredModel, setPreferredModel] = React.useState("claude-3-5-sonnet");
  const [saving, setSaving] = React.useState(false);

  function canAdvance() {
    if (step === 1) return workspaceName.trim().length >= 2;
    if (step === 2) return !!useCase;
    if (step === 3) return !!experienceLevel;
    return true;
  }

  async function complete() {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_name: workspaceName,
          use_case: useCase,
          experience_level: experienceLevel,
          preferred_model: preferredModel,
        }),
      });

      // Update local profile state
      if (profile) {
        setProfile({ ...profile, onboarding_completed: true });
      }

      router.push("/");
    } catch {
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "What's your workspace name?",
      subtitle: "This is how your workspace appears to collaborators.",
      content: (
        <div className="space-y-3">
          <Input
            placeholder="e.g. Acme Studio, My Projects"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            autoFocus
            className="text-[14px]"
          />
        </div>
      ),
    },
    {
      title: "What will you be building?",
      subtitle: "This helps us suggest the right templates and tools.",
      content: (
        <div className="grid grid-cols-2 gap-2">
          {USE_CASES.map((uc) => (
            <button
              key={uc.id}
              onClick={() => setUseCase(uc.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-[var(--radius-lg)] p-4 text-left ring-1 transition",
                useCase === uc.id
                  ? "bg-accent/8 ring-accent/40"
                  : "bg-surface ring-border hover:ring-accent/20",
              )}
            >
              <div className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                useCase === uc.id ? "bg-accent/15" : "bg-muted/50",
              )}>
                <uc.icon className={cn("size-4", useCase === uc.id ? "text-accent" : "text-muted-foreground")} strokeWidth={1.75} />
              </div>
              <div>
                <p className={cn("text-[13px] font-semibold", useCase === uc.id ? "text-foreground" : "text-foreground/80")}>
                  {uc.label}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{uc.desc}</p>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Your experience level?",
      subtitle: "We'll adjust how we explain things and which features to highlight.",
      content: (
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((level) => (
            <button
              key={level.id}
              onClick={() => setExperienceLevel(level.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[var(--radius-lg)] p-4 text-left ring-1 transition",
                experienceLevel === level.id
                  ? "bg-accent/8 ring-accent/40"
                  : "bg-surface ring-border hover:ring-accent/20",
              )}
            >
              <div className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full ring-1 transition",
                experienceLevel === level.id ? "bg-accent ring-accent" : "ring-border",
              )}>
                {experienceLevel === level.id && <Check className="size-3 text-white" strokeWidth={3} />}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{level.label}</p>
                <p className="text-[12px] text-muted-foreground">{level.desc}</p>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Pick your default AI model",
      subtitle: "You can always switch models during any session.",
      content: (
        <div className="space-y-2">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPreferredModel(m.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[var(--radius-lg)] p-4 text-left ring-1 transition",
                preferredModel === m.id
                  ? "bg-accent/8 ring-accent/40"
                  : "bg-surface ring-border hover:ring-accent/20",
              )}
            >
              <div className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full ring-1 transition",
                preferredModel === m.id ? "bg-accent ring-accent" : "ring-border",
              )}>
                {preferredModel === m.id && <Check className="size-3 text-white" strokeWidth={3} />}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{m.label}</p>
                <p className="text-[12px] text-muted-foreground">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Three modes. One OS.",
      subtitle: "DreamOS86 works in three modes. Each feels completely different.",
      content: (
        <div className="space-y-3">
          {MODES_INTRO.map((mode) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.id}
                className="flex gap-3 rounded-[var(--radius-lg)] bg-surface p-4 ring-1 ring-border"
              >
                <div className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
                  mode.accent,
                )}>
                  <Icon className="size-4" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{mode.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{mode.desc}</p>
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-[11.5px] text-muted-foreground">
            Start with <span className="font-semibold text-foreground">Build</span> to generate your first app — you can switch modes at any time.
          </p>
        </div>
      ),
    },
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="relative -mx-[var(--page-padding-x)] -my-[var(--page-padding-y)] flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden bg-atmosphere px-4 py-12">
      <div className="pointer-events-none absolute -left-[20%] top-[-15%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_15%,transparent),transparent_62%)] blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500",
                i < step ? "bg-accent" : "bg-muted/60",
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-6">
              <div className="mb-1 text-[12px] font-medium text-accent">
                Step {step} of {TOTAL_STEPS}
              </div>
              <h1 className="text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                {currentStep.title}
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {currentStep.subtitle}
              </p>
            </div>

            {currentStep.content}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center gap-3">
          {step > 1 && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setStep((s) => s - 1)}
              className="gap-1.5"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} /> Back
            </Button>
          )}
          <Button
            variant="accent"
            size="md"
            disabled={!canAdvance() || saving}
            onClick={() => {
              if (step < TOTAL_STEPS) setStep((s) => s + 1);
              else complete();
            }}
            className="ml-auto gap-1.5"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : step < TOTAL_STEPS ? (
              <>Continue <ArrowRight className="size-3.5" strokeWidth={2} /></>
            ) : (
              <>Finish setup <Check className="size-3.5" strokeWidth={2.5} /></>
            )}
          </Button>
        </div>

        <button
          onClick={complete}
          disabled={saving}
          className="mt-4 w-full text-center text-[12px] text-muted-foreground/60 transition hover:text-muted-foreground"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
