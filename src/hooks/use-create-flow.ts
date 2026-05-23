"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { CreateIntentResult } from "@/lib/intent/create-intent-classifier";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import type { BuildTier } from "@/components/create/create-build-confirm-step";
import type { CreateTemplate } from "@/components/create/create-template-picker";
import {
  buildTierToQualityLevel,
  qualityLevelToBudgetMode,
  readCreateFlowConfig,
} from "@/lib/create/create-flow-config";
import {
  flowStateFromLifecycle,
  type CreateFlowState,
  type CreateFlowUiStep,
  uiStepForFlowState,
} from "@/lib/create/create-flow-state";
import type { ProjectLifecycleStatus } from "@/lib/projects/project-lifecycle";
import { createDreamChatTransport } from "@/lib/chat/create-chat-transport";
import { runAiPreflightDeduped } from "@/lib/ai/preflight-inflight";
import { isAiPreflightSuccess } from "@/lib/ai/preflight-types";
import { DEFAULT_MODEL_ID } from "@/lib/creation/models";
import type { TimelineStage } from "@/components/create/create-progress-timeline";
import { toast } from "@/lib/toast";

export type UseCreateFlowOptions = {
  initialPrompt?: string;
  initialProjectId?: string | null;
};

export function useCreateFlow({ initialPrompt = "", initialProjectId = null }: UseCreateFlowOptions) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [projectId, setProjectId] = React.useState<string | null>(initialProjectId);
  const [localPhase, setLocalPhase] = React.useState<CreateFlowState | null>(null);
  const [intent, setIntent] = React.useState<CreateIntentResult | null>(null);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [stylePresetId, setStylePresetId] = React.useState<string | null>("minimal");
  const [buildTier, setBuildTier] = React.useState<BuildTier>("standard");
  const [blueprint, setBlueprint] = React.useState<AppBlueprint | null>(null);
  const [blueprintApproved, setBlueprintApproved] = React.useState(false);
  const [quoteCredits, setQuoteCredits] = React.useState<number | null>(null);
  const [quoteCreditsMax, setQuoteCreditsMax] = React.useState<number | null>(null);
  const [cheaperRecommended, setCheaperRecommended] = React.useState(false);
  const [lifecycle, setLifecycle] = React.useState<ProjectLifecycleStatus>("draft");
  const [fileCount, setFileCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [summaryLoaded, setSummaryLoaded] = React.useState(!initialProjectId);
  const [isZipImport, setIsZipImport] = React.useState(false);
  const [projectCreating, setProjectCreating] = React.useState(false);
  const [projectJustCreated, setProjectJustCreated] = React.useState(false);

  const approvedBlueprintRef = React.useRef<Record<string, unknown> | null>(null);
  const projectIdRef = React.useRef<string | null>(projectId);
  const buildTierRef = React.useRef(buildTier);
  const templateIdRef = React.useRef(templateId);
  const stylePresetIdRef = React.useRef(stylePresetId);
  projectIdRef.current = projectId;
  buildTierRef.current = buildTier;
  templateIdRef.current = templateId;
  stylePresetIdRef.current = stylePresetId;

  const transport = React.useMemo(
    () =>
      createDreamChatTransport({
        label: "create-funnel",
        getBody: () => ({
          modelId: DEFAULT_MODEL_ID,
          mode: "build",
          projectId: projectIdRef.current ?? undefined,
          approvedBlueprint: approvedBlueprintRef.current ?? undefined,
          qualityLevel: buildTierToQualityLevel(buildTierRef.current),
          templateId: templateIdRef.current ?? undefined,
          stylePresetId: stylePresetIdRef.current ?? undefined,
        }),
      }),
    [],
  );

  const { sendMessage, status, error: chatError } = useChat({
    id: `create-funnel-${projectId ?? "new"}`,
    transport,
  });

  const isStreaming = status === "submitted" || status === "streaming";

  const flowState = React.useMemo((): CreateFlowState => {
    if (localPhase) return localPhase;
    return flowStateFromLifecycle({
      lifecycle,
      fileCount,
      blueprintApproved,
      isStreaming,
      localPhase: null,
    });
  }, [localPhase, lifecycle, fileCount, blueprintApproved, isStreaming]);

  const uiStep: CreateFlowUiStep = uiStepForFlowState(flowState);

  const refreshSummary = React.useCallback(async (pid: string) => {
    const res = await fetch(`/api/projects/${pid}/summary`);
    if (!res.ok) {
      setSummaryLoaded(true);
      return;
    }
    const data = await res.json();
    setLifecycle((data.lifecycle_status as ProjectLifecycleStatus) ?? "draft");
    setFileCount(data.fileCount ?? 0);
    const meta = (data.project?.metadata ?? {}) as Record<string, unknown>;
    setIsZipImport(meta.source === "zip_import" || Boolean((meta.import as Record<string, unknown>)?.original_name));
    setSummaryLoaded(true);
    const cfg = readCreateFlowConfig(data.project?.metadata);
    setTemplateId(cfg.templateId);
    setStylePresetId(cfg.stylePresetId);
    setBuildTier(cfg.buildTier);
    if (data.project?.metadata) {
      const meta = data.project.metadata as Record<string, unknown>;
      if (meta.approved_blueprint) {
        setBlueprint(meta.approved_blueprint as AppBlueprint);
        setBlueprintApproved(true);
        approvedBlueprintRef.current = meta.approved_blueprint as Record<string, unknown>;
      }
    }
  }, []);

  React.useEffect(() => {
    if (!projectId) return;
    void refreshSummary(projectId);
    const id = setInterval(() => void refreshSummary(projectId), isStreaming ? 2500 : 30_000);
    return () => clearInterval(id);
  }, [projectId, refreshSummary, isStreaming]);

  React.useEffect(() => {
    if (!initialProjectId) return;
    setProjectId(initialProjectId);
    setSummaryLoaded(false);
    void refreshSummary(initialProjectId);
  }, [initialProjectId, refreshSummary]);

  React.useEffect(() => {
    if (!initialProjectId || !summaryLoaded) return;
    const ready =
      fileCount > 0 ||
      isZipImport ||
      ["generated", "preview_ready", "publish_ready", "published", "imported", "imported_preview_ready"].includes(
        lifecycle,
      );
    if (ready) router.replace(`/apps/${initialProjectId}/builder`);
  }, [initialProjectId, summaryLoaded, fileCount, isZipImport, lifecycle, router]);

  const persistConfig = React.useCallback(
    async (patch: {
      templateId?: string | null;
      stylePresetId?: string | null;
      buildTier?: BuildTier;
      createFlowState?: CreateFlowState;
    }) => {
      if (!projectId) return;
      await fetch(`/api/projects/${projectId}/create-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [projectId],
  );

  const classifyIntent = React.useCallback(async () => {
    setLocalPhase("classifying_intent");
    setError(null);
    const res = await fetch("/api/projects/classify-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim(), projectId }),
    });
    const data = (await res.json()) as CreateIntentResult;
    setIntent(data);
    if (data.intent === "question_only" || data.intent === "unsafe_or_invalid") {
      setLocalPhase("intent_ready");
      return data;
    }
    if (data.needsClarification && !data.shouldCreateProject) {
      setLocalPhase("needs_clarification");
      return data;
    }
    setLocalPhase("intent_ready");
    return data;
  }, [prompt, projectId]);

  const createProjectOnce = React.useCallback(async () => {
    if (projectId) {
      setLocalPhase("project_ready");
      return projectId;
    }
    setLocalPhase("project_creating");
    setProjectCreating(true);
    setError(null);
    const res = await fetch("/api/projects/create-from-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        source: templateId ? "template" : "prompt",
        templateId,
        stylePresetId,
        buildTier,
      }),
    });
    const data = await res.json();
    setProjectCreating(false);
    if (!data.ok) {
      if (data.code === "question_only") {
        setLocalPhase("intent_ready");
        setIntent((prev) =>
          prev ?? {
            intent: "question_only",
            confidence: 0.95,
            shouldCreateProject: false,
            shouldReserveBuildCredits: false,
            shouldFullBuild: false,
            needsClarification: false,
            userMessage: data.userMessage ?? data.error,
          },
        );
        setError(data.userMessage ?? data.error);
        return null;
      }
      setLocalPhase("failed");
      setError(data.error ?? "Could not create app");
      return null;
    }
    setProjectId(data.projectId);
    setLifecycle(data.lifecycleStatus ?? "intent_review");
    setLocalPhase("project_ready");
    setProjectJustCreated(true);
    router.replace(`/create?projectId=${data.projectId}`, { scroll: false });
    return data.projectId as string;
  }, [projectId, prompt, templateId, stylePresetId, buildTier, router]);

  const generateBlueprint = React.useCallback(async () => {
    const pid = projectId ?? (await createProjectOnce());
    if (!pid) return;
    setLocalPhase("blueprint_generating");
    setError(null);
    const quality = buildTierToQualityLevel(buildTier);
    const res = await fetch("/api/build/blueprint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        projectId: pid,
        templateId,
        stylePresetId,
        qualityLevel: quality,
        mode: quality === "quick" ? "deterministic_quick" : "llm_enriched",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.blueprint) {
      setLocalPhase("failed");
      setError(data.error ?? "Blueprint failed");
      return;
    }
    setBlueprint(data.blueprint as AppBlueprint);
    setBlueprintApproved(false);
    setLocalPhase("blueprint_ready");
    await persistConfig({ createFlowState: "blueprint_ready" });
  }, [projectId, createProjectOnce, prompt, templateId, stylePresetId, buildTier, persistConfig]);

  const fetchQuote = React.useCallback(async () => {
    const res = await fetch("/api/credits/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "build",
        prompt: prompt.trim(),
        projectId,
        qualityLevel: qualityLevelToBudgetMode(buildTier),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setQuoteCredits(data.estimatedCost ?? data.creditsEstimate ?? null);
      setQuoteCreditsMax(data.reservedEstimate ?? data.creditsEstimateMax ?? null);
      setCheaperRecommended(Boolean(data.cheaperRecommended));
      setLocalPhase("awaiting_build_confirmation");
    }
  }, [prompt, projectId, buildTier]);

  const approveBlueprint = React.useCallback(async () => {
    if (!blueprint || !projectId) return;
    const res = await fetch("/api/build/blueprint", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprint, projectId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not approve blueprint");
      return;
    }
    approvedBlueprintRef.current = (data.blueprint ?? blueprint) as Record<string, unknown>;
    setBlueprintApproved(true);
    setLocalPhase("quote_ready");
    await persistConfig({ createFlowState: "quote_ready" });
    await fetchQuote();
  }, [blueprint, projectId, persistConfig, fetchQuote]);

  const startBuild = React.useCallback(async () => {
    if (!projectId || !blueprintApproved) {
      toast.error("Approve the blueprint before building.");
      return;
    }
    setLocalPhase("building");
    setError(null);
    const pre = await runAiPreflightDeduped({
      mode: "build",
      prompt: prompt.trim(),
      projectId,
      modelId: DEFAULT_MODEL_ID,
    });
    if (!isAiPreflightSuccess(pre)) {
      setLocalPhase("awaiting_build_confirmation");
      setError(pre.error);
      toast.error(pre.error);
      return;
    }
    await persistConfig({ createFlowState: "building", buildTier });
    await sendMessage({ text: prompt.trim() });
  }, [projectId, blueprintApproved, prompt, persistConfig, sendMessage]);

  const applyTemplate = React.useCallback(
    (t: CreateTemplate) => {
      setTemplateId(t.id);
      if (t.prompt) setPrompt(t.prompt);
      void persistConfig({ templateId: t.id });
    },
    [persistConfig],
  );

  const applyStyle = React.useCallback(
    (id: string) => {
      setStylePresetId(id);
      void persistConfig({ stylePresetId: id });
    },
    [persistConfig],
  );

  const applyBuildTier = React.useCallback(
    (tier: BuildTier) => {
      setBuildTier(tier);
      void persistConfig({ buildTier: tier });
      void fetchQuote();
    },
    [persistConfig, fetchQuote],
  );

  const continueFromIdea = React.useCallback(async () => {
    const classified = await classifyIntent();
    if (classified.intent === "question_only") return;
    if (classified.needsClarification && !classified.shouldCreateProject) return;
    setLocalPhase("intent_ready");
  }, [classifyIntent]);

  const continueFromIntent = React.useCallback(async () => {
    const classified = intent ?? (await classifyIntent());
    if (classified.intent === "question_only") return;
    if (classified.needsClarification && !classified.shouldCreateProject) return;
    await createProjectOnce();
  }, [intent, classifyIntent, createProjectOnce]);

  const continueFromTemplate = React.useCallback(async () => {
    setProjectJustCreated(false);
    await persistConfig({
      templateId,
      stylePresetId,
      buildTier,
      createFlowState: "project_ready",
    });
    await generateBlueprint();
  }, [persistConfig, templateId, stylePresetId, buildTier, generateBlueprint]);

  const timeline = React.useMemo((): TimelineStage[] => {
    return [
      { id: "project", label: "App record created", state: projectId ? "done" : "pending" },
      {
        id: "intent",
        label: "Intent reviewed",
        state: intent && intent.intent !== "question_only" ? "done" : intent ? "active" : "pending",
      },
      {
        id: "blueprint",
        label: "Blueprint approved",
        state: blueprintApproved ? "done" : localPhase === "blueprint_generating" ? "active" : "pending",
      },
      {
        id: "build",
        label: "Generating files",
        state: isStreaming ? "active" : fileCount > 0 ? "done" : "pending",
      },
      {
        id: "handoff",
        label: "Ready for builder",
        state:
          fileCount > 0 && !isStreaming
            ? "done"
            : lifecycle === "generated" || lifecycle === "preview_ready"
              ? "done"
              : "pending",
      },
    ];
  }, [projectId, intent, blueprintApproved, localPhase, isStreaming, fileCount, lifecycle]);

  React.useEffect(() => {
    if (!isStreaming && fileCount > 0) {
      setLocalPhase(null);
    }
  }, [isStreaming, fileCount]);

  return {
    prompt,
    setPrompt,
    projectId,
    flowState,
    uiStep,
    intent,
    templateId,
    stylePresetId,
    buildTier,
    blueprint,
    blueprintApproved,
    quoteCredits,
    quoteCreditsMax,
    cheaperRecommended,
    timeline,
    isStreaming,
    projectCreating,
    projectJustCreated,
    error: error ?? (chatError?.message ?? null),
    lifecycle,
    fileCount,
    summaryLoaded,
    isZipImport,
    classifyIntent,
    createProjectOnce,
    generateBlueprint,
    approveBlueprint,
    fetchQuote,
    startBuild,
    applyTemplate,
    applyStyle,
    applyBuildTier,
    continueFromIdea,
    continueFromIntent,
    continueFromTemplate,
    persistConfig,
    refreshSummary,
  };
}
