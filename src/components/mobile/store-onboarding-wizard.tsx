"use client";

import * as React from "react";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPLE_WIZARD_STEPS,
  GOOGLE_PLAY_WIZARD_STEPS,
  canAdvanceWizardStep,
  wizardProgressPercent,
  type StoreOnboardingProgress,
  type StoreWizardPlatform,
} from "@/lib/mobile/store-onboarding-steps";

export function StoreOnboardingWizard({
  platform,
  progress,
  onProgressChange,
  gatePassed,
}: {
  platform: StoreWizardPlatform;
  progress: StoreOnboardingProgress;
  onProgressChange: (next: StoreOnboardingProgress) => void;
  gatePassed: boolean;
}) {
  const steps = platform === "google_play" ? GOOGLE_PLAY_WIZARD_STEPS : APPLE_WIZARD_STEPS;
  const map = platform === "google_play" ? progress.google_play : progress.apple_app_store;
  const pct = wizardProgressPercent(platform, progress);

  function toggle(stepId: string) {
    if (!canAdvanceWizardStep(steps, map, stepId)) return;
    const nextMap = { ...map, [stepId]: !map[stepId] };
    onProgressChange({
      ...progress,
      ...(platform === "google_play"
        ? { google_play: nextMap }
        : { apple_app_store: nextMap }),
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4" data-testid="store-onboarding-wizard">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">
          {platform === "google_play" ? "Google Play setup" : "App Store setup"}
        </h3>
        <span className="text-[11px] font-medium text-accent">{pct}% complete</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-2">
        {steps.map((step, idx) => {
          const done = Boolean(map[step.id]);
          const locked = !canAdvanceWizardStep(steps, map, step.id);
          return (
            <li
              key={step.id}
              className={cn(
                "flex gap-3 rounded-xl px-3 py-2.5 ring-1",
                done ? "bg-emerald-500/5 ring-emerald-500/20" : "bg-background ring-border/60",
                locked && "opacity-50",
              )}
            >
              <button
                type="button"
                disabled={locked}
                onClick={() => toggle(step.id)}
                className="mt-0.5 shrink-0"
                aria-label={done ? "Mark incomplete" : "Mark complete"}
              >
                {locked ? (
                  <Lock className="size-4 text-muted-foreground" />
                ) : done ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-foreground">
                  {idx + 1}. {step.title}
                  {step.required ? null : (
                    <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {pct < 100 ? (
        <p className="mt-3 text-[11px] text-amber-800 dark:text-amber-200">
          Complete required steps in order — you cannot skip ahead.
        </p>
      ) : gatePassed ? (
        <p className="mt-3 text-[11px] text-emerald-700 dark:text-emerald-300">
          Store onboarding complete. Eligibility scan passed — packaging unlocked.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-amber-800 dark:text-amber-200">
          Store steps done — run the eligibility scan to unlock packaging.
        </p>
      )}
    </div>
  );
}
