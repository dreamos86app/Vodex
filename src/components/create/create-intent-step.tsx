"use client";

import * as React from "react";
import { MessageSquare, Hammer, HelpCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateIntentResult } from "@/lib/intent/create-intent-classifier";
import { CreateStepSkeleton } from "@/components/create/create-step-skeleton";

const INTENT_UI: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  question_only: { label: "Question", icon: HelpCircle, tone: "text-sky-600" },
  app_idea: { label: "App idea", icon: MessageSquare, tone: "text-violet-600" },
  app_build_request: { label: "Build request", icon: Hammer, tone: "text-accent" },
  app_edit_request: { label: "Edit request", icon: Hammer, tone: "text-amber-600" },
  ambiguous: { label: "Needs clarification", icon: AlertCircle, tone: "text-amber-600" },
};

export function CreateIntentStep({
  result,
  loading,
}: {
  result: CreateIntentResult | null;
  loading?: boolean;
}) {
  if (loading) return <CreateStepSkeleton lines={2} />;
  if (!result) return null;

  const cfg = INTENT_UI[result.intent] ?? INTENT_UI.ambiguous;
  const Icon = cfg.icon;

  return (
    <div className="rounded-2xl bg-surface px-4 py-4 ring-1 ring-border shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-border", cfg.tone)}>
          <Icon className="size-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Intent review</p>
          <p className="mt-0.5 text-[15px] font-semibold text-foreground">{cfg.label}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{result.userMessage}</p>
          {result.needsClarification && result.clarificationPrompt && (
            <p className="mt-2 text-[12px] font-medium text-amber-600 dark:text-amber-400">{result.clarificationPrompt}</p>
          )}
        </div>
      </div>
      {result.intent === "question_only" && (
        <p className="mt-3 rounded-lg bg-sky-500/10 px-3 py-2 text-[12px] text-sky-800 dark:text-sky-200">
          This is a question — no app was created. Rephrase as a build request to continue.
        </p>
      )}
    </div>
  );
}
