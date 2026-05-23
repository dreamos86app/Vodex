"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateFlow } from "@/hooks/use-create-flow";
import {
  CREATE_FLOW_STEP_LABELS,
  CREATE_FLOW_STEP_ORDER,
  type CreateFlowUiStep,
} from "@/lib/create/create-flow-state";
import { CreateIntentStep } from "@/components/create/create-intent-step";
import { CreateTemplatePicker } from "@/components/create/create-template-picker";
import { CreateStylePresets } from "@/components/create/create-style-presets";
import { CreateBuildConfirmStep } from "@/components/create/create-build-confirm-step";
import { CreateCreditEstimate } from "@/components/create/create-credit-estimate";
import { CreateProgressTimeline } from "@/components/create/create-progress-timeline";
import { CreateFlowSummary, costTierFromBuildTier } from "@/components/create/create-flow-summary";
import { CreateIncludedExcluded } from "@/components/create/create-included-excluded";
import { CreateStepSkeleton } from "@/components/create/create-step-skeleton";
import { RepairCenter } from "@/components/repair/repair-center";

function stepIndex(step: CreateFlowUiStep): number {
  return CREATE_FLOW_STEP_ORDER.indexOf(step);
}

type TemplatePhase = "starting_point" | "visual_style";

export function PremiumCreateFunnel({
  initialPrompt = "",
  initialProjectId = null,
}: {
  initialPrompt?: string;
  initialProjectId?: string | null;
}) {
  const router = useRouter();
  const flow = useCreateFlow({ initialPrompt, initialProjectId });
  const currentIdx = stepIndex(flow.uiStep);
  const [templatePhase, setTemplatePhase] = React.useState<TemplatePhase>("starting_point");
  const [mobileSummaryOpen, setMobileSummaryOpen] = React.useState(false);

  React.useEffect(() => {
    if (flow.uiStep !== "template") setTemplatePhase("starting_point");
  }, [flow.uiStep]);

  const stickyAction = React.useMemo(() => {
    switch (flow.uiStep) {
      case "idea":
        return {
          label: "Review intent",
          disabled: !flow.prompt.trim() || flow.flowState === "classifying_intent",
          onClick: () => void flow.continueFromIdea(),
        };
      case "intent":
        if (flow.intent?.intent === "question_only") {
          return { label: "Edit your description", disabled: false, onClick: () => flow.setPrompt(flow.prompt) };
        }
        return {
          label: flow.projectId ? "Continue" : "Create app & continue",
          disabled: flow.projectCreating,
          onClick: () => void flow.continueFromIntent(),
        };
      case "template":
        if (templatePhase === "starting_point") {
          return {
            label: "Choose the visual style",
            disabled: !flow.templateId,
            onClick: () => setTemplatePhase("visual_style"),
          };
        }
        return {
          label: "Review the blueprint",
          disabled: !flow.stylePresetId,
          onClick: () => void flow.continueFromTemplate(),
        };
      case "blueprint":
        return {
          label: flow.blueprint ? "Approve blueprint" : "Generate blueprint",
          disabled: flow.flowState === "blueprint_generating",
          onClick: () =>
            flow.blueprint ? void flow.approveBlueprint() : void flow.generateBlueprint(),
        };
      case "quote":
      case "confirm":
        return {
          label: "Start build",
          disabled: !flow.blueprintApproved || flow.isStreaming,
          onClick: () => void flow.startBuild(),
        };
      case "progress":
        return {
          label: flow.fileCount > 0 && !flow.isStreaming ? "Open builder" : "Building…",
          disabled: flow.isStreaming || !flow.projectId,
          onClick: () => flow.projectId && router.push(`/apps/${flow.projectId}/builder`),
        };
      case "handoff":
        return {
          label: "Open builder",
          disabled: !flow.projectId,
          onClick: () => flow.projectId && router.push(`/apps/${flow.projectId}/builder`),
        };
      default:
        return { label: "Continue", disabled: true, onClick: () => {} };
    }
  }, [flow, router, templatePhase]);

  const showIncluded = flow.uiStep === "blueprint" || flow.uiStep === "quote" || flow.uiStep === "confirm";

  if (initialProjectId && !flow.summaryLoaded) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="size-6 animate-spin text-accent" strokeWidth={1.75} />
        <p className="text-[13px] text-muted-foreground">Loading your app…</p>
      </div>
    );
  }

  return (
    <div className="create-funnel-root flex min-h-[100dvh] flex-col overflow-x-hidden bg-background">
      <header className="shrink-0 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-5 shrink-0 text-accent" strokeWidth={1.75} />
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight sm:text-[16px]">Create your app</h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                One guided path — clear steps from idea to builder.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Your Apps
          </Link>
        </div>

        <nav
          aria-label="Create progress"
          className="mx-auto mt-3 max-w-6xl space-y-2"
        >
          <div className="h-1 overflow-hidden rounded-full bg-border/70">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${Math.max(8, ((currentIdx + 1) / CREATE_FLOW_STEP_ORDER.length) * 100)}%` }}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CREATE_FLOW_STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition",
                  i < currentIdx && "bg-accent/10 text-accent",
                  i === currentIdx && "bg-accent text-white shadow-sm",
                  i > currentIdx && "bg-surface text-muted-foreground ring-1 ring-border",
                )}
              >
                {i + 1}. {CREATE_FLOW_STEP_LABELS[s]}
              </span>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:flex-row sm:px-6 sm:py-6">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface/50 shadow-sm ring-1 ring-border">
          <button
            type="button"
            className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 text-left sm:hidden"
            onClick={() => setMobileSummaryOpen((o) => !o)}
          >
            <span className="text-[12px] font-semibold">Summary</span>
            <ChevronDown className={cn("size-4 transition", mobileSummaryOpen && "rotate-180")} />
          </button>
          {mobileSummaryOpen && (
            <div className="border-b border-border/60 p-4 sm:hidden">
              <CreateFlowSummary
                uiStep={flow.uiStep}
                projectCreated={Boolean(flow.projectId)}
                templateId={flow.templateId}
                stylePresetId={flow.stylePresetId}
                buildTier={flow.buildTier}
                lifecycle={flow.lifecycle}
                fileCount={flow.fileCount}
                costTier={flow.uiStep === "quote" || flow.uiStep === "confirm" ? costTierFromBuildTier(flow.buildTier) : null}
                compact
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 sm:p-6 sm:pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={flow.uiStep + templatePhase}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {flow.uiStep === "idea" && (
                  <label className="block">
                    <span className="text-[15px] font-semibold tracking-tight text-foreground">Describe your app</span>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      I&apos;ll check if this is a question, idea, or build request.
                    </p>
                    <textarea
                      value={flow.prompt}
                      onChange={(e) => flow.setPrompt(e.target.value)}
                      rows={5}
                      placeholder="Build me a CRM for dentists with scheduling and patient notes…"
                      className="mt-4 w-full max-w-full resize-none rounded-2xl bg-background px-4 py-3 text-[15px] leading-relaxed ring-1 ring-border outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </label>
                )}

                {flow.uiStep === "intent" && (
                  <>
                    {flow.flowState === "classifying_intent" || flow.projectCreating ? (
                      <CreateStepSkeleton lines={3} />
                    ) : (
                      <CreateIntentStep result={flow.intent} loading={false} />
                    )}
                    {flow.projectId && flow.intent?.intent !== "question_only" && !flow.projectCreating && (
                      <p className="flex items-center gap-1.5 text-[13px] text-positive">
                        <CheckCircle2 className="size-4 shrink-0" />
                        App saved — it will appear in Your Apps immediately.
                      </p>
                    )}
                  </>
                )}

                {flow.uiStep === "template" && templatePhase === "starting_point" && (
                  <div>
                    {flow.projectId && (
                      <div
                        data-testid="create-success-state"
                        className="mb-4 rounded-2xl border border-positive/30 bg-positive/10 px-4 py-3 ring-1 ring-positive/20"
                      >
                        <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                          <CheckCircle2 className="size-4 shrink-0 text-positive" />
                          App created — ready to choose a starting point
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          Your app is saved and visible in Your Apps.
                        </p>
                        <span data-testid="create-project-id" className="sr-only">
                          {flow.projectId}
                        </span>
                        <Link
                          href="/dashboard"
                          data-testid="create-dashboard-handoff"
                          className="mt-2 inline-block text-[12px] font-medium text-accent hover:underline"
                        >
                          Open Your Apps
                        </Link>
                        <Link
                          href={`/apps/${flow.projectId}/builder?tab=code`}
                          data-testid="open-builder-button"
                          className="mt-2 ml-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-white"
                        >
                          Open builder
                        </Link>
                      </div>
                    )}
                    <p className="text-[15px] font-semibold tracking-tight">Choose a starting point</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Pick a template that matches what you want to build.
                    </p>
                    <div className="mt-4">
                      <CreateTemplatePicker selectedId={flow.templateId} onSelect={(t) => flow.applyTemplate(t)} />
                    </div>
                  </div>
                )}

                {flow.uiStep === "template" && templatePhase === "visual_style" && (
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight">Choose the visual style</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      This shapes colors, layout, and component feel in your app.
                    </p>
                    <div className="mt-4">
                      <CreateStylePresets
                        selectedId={flow.stylePresetId}
                        onSelect={(p) => flow.applyStyle(p.id)}
                      />
                    </div>
                  </div>
                )}

                {flow.uiStep === "blueprint" && (
                  <>
                    <div>
                      <p className="text-[15px] font-semibold tracking-tight">Review the blueprint</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        Confirm scope before we generate your app.
                      </p>
                    </div>
                    {flow.flowState === "blueprint_generating" ? (
                      <CreateStepSkeleton lines={4} />
                    ) : flow.blueprint ? (
                      <div
                        className="rounded-2xl bg-background p-4 ring-1 ring-border sm:p-5"
                        data-testid="create-blueprint-ready"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Blueprint ready</p>
                        <p className="mt-2 text-[17px] font-semibold tracking-tight sm:text-[18px]">{flow.blueprint.appName}</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                          {flow.blueprint.oneSentencePitch}
                        </p>
                        <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-border/60">
                          <div className="border-b border-border/60 bg-surface/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Pages
                          </div>
                          <ul className="divide-y divide-border/50">
                            {(flow.blueprint.pages ?? []).slice(0, 8).map((p) => (
                              <li key={p.route} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:gap-3">
                                <span className="shrink-0 font-mono text-[11px] font-medium text-accent">{p.route}</span>
                                <span className="text-[12px] text-muted-foreground">{p.purpose}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">Generate a blueprint to review pages and scope.</p>
                    )}
                    {showIncluded && <CreateIncludedExcluded />}
                  </>
                )}

                {(flow.uiStep === "quote" || flow.uiStep === "confirm") && (
                  <>
                    {flow.isStreaming ? (
                      <CreateStepSkeleton lines={2} />
                    ) : (
                      <>
                        <CreateCreditEstimate buildTier={flow.buildTier} cheaperRecommended={flow.cheaperRecommended} />
                        <CreateBuildConfirmStep
                          selected={flow.buildTier}
                          onSelect={(t) => flow.applyBuildTier(t)}
                          cheaperRecommended={flow.cheaperRecommended}
                          disabled={flow.isStreaming}
                        />
                        <CreateIncludedExcluded />
                      </>
                    )}
                  </>
                )}

                {(flow.uiStep === "progress" || flow.uiStep === "handoff") && (
                  <>
                    <CreateProgressTimeline stages={flow.timeline} />
                    {flow.isStreaming && (
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Loader2 className="size-4 animate-spin text-accent" />
                        Building your app — status updates from the server.
                      </div>
                    )}
                    {flow.fileCount > 0 && !flow.isStreaming && (
                      <p
                        className="text-[13px] font-medium text-positive"
                        data-testid="create-build-ready"
                      >
                        Ready to build — {flow.fileCount} files generated.
                      </p>
                    )}
                    {flow.fileCount > 0 && !flow.isStreaming && flow.projectId && (
                      <button
                        type="button"
                        data-testid="open-builder-button"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-white"
                        onClick={() => router.push(`/apps/${flow.projectId}/builder?tab=code`)}
                      >
                        Open builder
                      </button>
                    )}
                  </>
                )}

                {flow.error && (
                  <div className="rounded-xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive ring-1 ring-destructive/20">
                    {flow.error}
                  </div>
                )}

                {flow.projectId && (flow.flowState === "failed" || flow.flowState === "needs_attention") && (
                  <RepairCenter projectId={flow.projectId} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/60 bg-surface/95 p-3 backdrop-blur-md safe-area-pad-b sm:p-4">
            <button
              type="button"
              disabled={stickyAction.disabled}
              onClick={stickyAction.onClick}
              data-create-build-btn
              data-testid="create-continue-button"
              className="flex w-full max-w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[14px] font-semibold text-white shadow-sm disabled:opacity-40 sm:py-3"
            >
              {flow.projectCreating || flow.isStreaming || flow.flowState === "classifying_intent" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {stickyAction.label}
            </button>
          </div>
        </main>

        <aside className="hidden w-full shrink-0 sm:block sm:max-w-[280px] lg:max-w-[300px]">
          <div className="sticky top-4 rounded-2xl bg-surface p-4 ring-1 ring-border shadow-sm">
            <CreateFlowSummary
              uiStep={flow.uiStep}
              projectCreated={Boolean(flow.projectId)}
              templateId={flow.templateId}
              stylePresetId={flow.stylePresetId}
              buildTier={flow.buildTier}
              lifecycle={flow.lifecycle}
              fileCount={flow.fileCount}
              costTier={
                flow.uiStep === "quote" || flow.uiStep === "confirm"
                  ? costTierFromBuildTier(flow.buildTier)
                  : null
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
