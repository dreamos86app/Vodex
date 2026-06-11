"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClientSearchParams } from "@/lib/hooks/use-client-search-params";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  ArrowUp,
  Paperclip,
  Loader2,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Zap,
  MonitorPlay,
  LayoutGrid,
  Code2,
  Smartphone,
  ChevronDown,
  MessageSquare,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { AppPlanInlineCard } from "@/components/create/workspace/app-plan-inline-card";
import { useAuthStore } from "@/lib/stores/auth-store";
import { refreshCredits, useCreditsStore } from "@/lib/stores/credits-store";
import { useProjectFiles, invalidateProjectFilesCache } from "@/hooks/use-project-files";
import { isProjectFilesReady, isImportedProjectReady } from "@/lib/projects/project-files-ready";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";

import {
  DEFAULT_MODEL_ID,
  MODE_META,
  type CreationMode,
} from "@/lib/creation/models";
import { toast } from "@/lib/toast";
import { sanitizeUserFacingAiError } from "@/lib/ai/provider-errors";
import { createDreamChatTransport } from "@/lib/chat/create-chat-transport";
import { runAiPreflightDeduped } from "@/lib/ai/preflight-inflight";
import { isAiPreflightSuccess, preflightBlockedLabel } from "@/lib/ai/preflight-types";
import { applyComposerPaste } from "@/lib/composer/textarea-handlers";
import { composerTextareaClass } from "@/components/ui/composer-shell";
import { ModelPicker } from "@/components/create/workspace/model-picker";
import {
  PlanFirstToggle,
  buildStrategyFromToggle,
  suggestBuildStrategy,
  toggleFromBuildStrategy,
  type BuildStrategy,
} from "@/components/create/workspace/plan-first-control";
import { ModeSwitch, type EditScope } from "@/components/create/workspace/mode-switch";
import { AttachmentRail, DropZone, type Attachment } from "@/components/create/workspace/attachment-rail";
import { PreviewPanel } from "@/components/create/workspace/preview-panel";
import { PreviewBlockedPopup, type PreviewBlockingIssue } from "@/components/preview/preview-blocked-popup";
import { resolveAuthoritativePreviewBlocker } from "@/lib/preview/preview-blocker-priority";
import { classifyImportedPreviewState } from "@/lib/preview/imported-preview-state";
import { routeBuilderTask } from "@/lib/intent/task-router";
import { RepairCenter } from "@/components/repair/repair-center";
import { buildRepairChatPrompt } from "@/lib/repair/repair-chat-prompt";
import { BuildLiveProgress } from "@/components/create/workspace/build-live-progress";
import { BuildCreditsUpgradePanel } from "@/components/billing/build-credits-upgrade-panel";
import {
  PublishModal,
  type PublishUiPhase,
  type PublishUiState,
} from "@/components/create/workspace/publish-modal";
import { AdminDiagnosticsFab } from "@/components/create/workspace/admin-diagnostics-fab";
import {
  persistWorkspaceTask,
  readWorkspaceTask,
  clearWorkspaceTask,
} from "@/lib/create/workspace-task-persistence";
import {
  deriveBuildStatusFacts,
  resolveBuildRunSummary,
  type WorkflowRunStatus,
} from "@/lib/build/workflow-status-guards";
import { resolveAppBuildTruthFromFacts } from "@/lib/build/app-build-truth";
import { BuildRunSummaryCard } from "@/components/create/workspace/build-run-summary";
import { classifyAppArchetype } from "@/lib/build/app-archetype-classifier";
import { userFacingArchetypeLabel } from "@/lib/workflow/user-facing-workflow-events";
import {
  userFacingPartialBuildStartMessage,
} from "@/lib/billing/partial-build-credits";
import { useBuildJobProgress, type BuildJobPollState } from "@/hooks/use-build-job-progress";
import { enqueueAsyncBuild } from "@/lib/create/async-build-client";
import { classifyBuildIntent, shouldStartBuildPipeline } from "@/lib/ai/build-intent-classifier";
import {
  replaceBrowserUrl,
  syncProjectIdInAddressBar,
} from "@/lib/navigation/builder-url";
import {
  BUILDER_SECTION_NAV_EVENT,
  builderSectionPath,
  type BuilderSectionNavEvent,
  type BuilderSectionTarget,
} from "@/lib/navigation/builder-section-navigation";
import {
  VersionHistoryDrawer,
  VersionHistoryEntryButton,
} from "@/components/builder/version-history-drawer";
import { PROMPT_QUEUE_FULL_MESSAGE, PROMPT_QUEUE_MAX } from "@/lib/create/queue-constants";
import {
  canSubmitComposer,
  composerHasMeaningfulText,
  getComposerText,
  resolveComposerSubmitDisabledReason,
} from "@/lib/create/composer-text";
import { BuilderAssistantMessage } from "@/components/builder/builder-event-ui";
import { ComposerPromptQueue } from "@/components/create/workspace/composer-prompt-queue";
import { DreamOSMessageShell } from "@/components/create/workspace/dreamos-message-shell";
import { OptimisticAssistantRow } from "@/components/create/workspace/optimistic-assistant-row";
import {
  parseBuildPlanCard,
  taskProgressIndex,
} from "@/lib/creation/parse-build-plan";
import { extractBuilderMetadata } from "@/lib/creation/parse-builder-metadata";
import { isSubmitDebugEnabled } from "@/lib/dev/submit-debug-enabled";
import { IntegrationSecretsPanel } from "@/components/create/workspace/integration-secrets-panel";
import { detectRequiredSecretNames } from "@/lib/integrations/detect-required-secrets";
import { WorkspaceLauncher, type WorkspaceRightTab } from "@/components/create/workspace/workspace-launcher";
import { AppDashboardPanel, type DashSection } from "@/components/create/workspace/app-dashboard-panel";
import { SecretSetupPanel } from "@/components/chat/secret-setup-panel";
import { isSecretsHelperPrompt, SECRETS_HELPER_PROMPT } from "@/lib/secrets/secrets-helper-prompt";
import type { CodeExplorerFile } from "@/components/create/workspace/code-explorer-panel";
import { AppBuilderWorkspace } from "@/components/builder/app-builder-workspace";
import { MobileWrapperStudio } from "@/components/mobile/mobile-wrapper-studio";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { findProjectConversationId } from "@/lib/projects/project-conversation";
import {
  clearOperationSubmitted,
  consumeAutostartHandoff,
  storeAutostartHandoff,
  peekPendingAutostartHandoff,
  markAutostartDone,
  markOperationSubmitted,
  seedPendingFromUrl,
  shouldSkipDuplicateClientSubmit,
  wasOperationSubmitted,
} from "@/lib/create/autostart-handoff";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";
import { resolveProjectDisplayName } from "@/lib/projects/provisional-app-name";
import { notifyProjectCatalogUpdated } from "@/lib/projects/project-catalog-sync";
import { isUuid } from "@/lib/utils/uuid";
import { projectPreviewFrameUrl } from "@/lib/preview/preview-frame-url";
import { clearPreviewClientCache } from "@/lib/preview/clear-preview-client-cache";
import { resolvePreviewIframeUrl } from "@/lib/preview/preview-iframe-url-resolver";
import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";
import { isHardImportedPreviewReady } from "@/lib/preview/resolve-preview-state";
import { shouldPollPreviewRuntime } from "@/lib/preview/should-poll-preview-runtime";
import { previewRuntimeStatusEqual } from "@/lib/preview/preview-runtime-status-equal";
import {
  detectPreviewRoutesFromFiles,
  type PreviewRouteEntry,
} from "@/lib/preview/detect-preview-routes";
import { reconcileProjectBuildState } from "@/lib/build/reconcile-project-build";
import { resolveDisplayName } from "@/lib/profile-display";
import {
  isZipImportProject,
  readImportMeta,
} from "@/lib/projects/imported-project-state";
import { extractFencedCode, stripFencedCodeForChat, parseFencedFiles } from "@/lib/creation/extract-fenced-code";
import { submitDebug, uiSubmitLog } from "@/lib/dev/submit-debug";
import { useComposerClickCapture } from "@/lib/dev/composer-click-capture";
import { pushSubmitTrace } from "@/lib/dev/submit-pipeline-trace";
import { SubmitPipelinePanel } from "@/components/dev/submit-pipeline-panel";
import { CREATE_BUILD_BUNDLE } from "@/lib/dev/create-build-bundle";
import type { Tables } from "@/lib/supabase/types";
import type { CreateIntentResult } from "@/lib/intent/create-intent-classifier";

async function repairPersistedBuildStateTruth(projectId: string): Promise<void> {
  try {
    await fetch(`/api/projects/${projectId}/build-state-truth`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startPreview: true }),
    });
  } catch {
    /* best-effort server repair */
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEND_COOLDOWN_MS = 900;

function messageText(m: UIMessage): string {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function newAttachmentId() {
  return `att_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export type CreateWorkspaceProject = Pick<
  Tables<"projects">,
  | "id"
  | "name"
  | "preview_url"
  | "icon_url"
  | "gradient"
  | "status"
  | "framework"
  | "custom_domain"
  | "is_public"
  | "metadata"
  | "published_subdomain"
> &
  Partial<Pick<Tables<"projects">, "build_status" | "app_name" | "icon_svg">>;

/** Display names for the next tier (DB `plan_id` is free | pro | business | enterprise). */
const PLAN_NEXT_LABEL: Record<string, string> = {
  free: "Starter",
  pro: "Infinity",
  business: "Infinity",
  enterprise: "Infinity",
};

function MessageBubble({
  message,
  userAvatar,
  userName,
  streaming,
  mode,
  creditsUsed,
  costState,
  planFooter,
}: {
  message: UIMessage;
  userAvatar?: string | null;
  userName: string;
  streaming?: boolean;
  mode: CreationMode;
  creditsUsed?: number | null;
  costState?: import("@/components/chat/message-cost-header").MessageCostState;
  planFooter?: React.ReactNode;
}) {
  const isUser = message.role === "user";
  const raw = messageText(message);
  const text = !isUser ? stripFencedCodeForChat(raw) : raw;
  const buildMeta = !isUser ? extractBuilderMetadata(raw) : null;
  const buildPlan = !isUser ? parseBuildPlanCard(raw) : null;
  const useCards =
    !isUser &&
    (mode === "build" ||
      Boolean(buildMeta) ||
      Boolean(buildPlan) ||
      /##\s*\[(planning|design|frontend|polish)\]/i.test(raw) ||
      raw.includes("dreamos-app-meta"));
  const progressIndex =
    buildPlan && mode === "build"
      ? taskProgressIndex(raw.length, buildPlan.taskLabels.length)
      : 0;

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("group flex gap-2.5 flex-row-reverse")}
      >
        <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-border">
          {userAvatar ? (
            <Image src={userAvatar} alt={userName} width={24} height={24} className="size-full object-cover" unoptimized />
          ) : (
            <span className="text-[9px] font-semibold text-foreground">{userName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 max-w-[82%] rounded-xl bg-accent px-3 py-2 text-[13px] leading-relaxed text-white">
          {text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group">
      <DreamOSMessageShell
        mode={mode}
        status={streaming ? "thinking" : text ? "done" : "thinking"}
        costState={streaming ? "pending" : costState}
        creditsUsed={creditsUsed}
        messageTextForCopy={text || undefined}
      >
        {!text && streaming && mode !== "build" ? (
          <div className="rounded-xl bg-surface/80 px-3 py-2.5 text-[13px] text-muted-foreground ring-1 ring-border/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              Working on your request…
            </span>
          </div>
        ) : useCards && (buildPlan || buildMeta || streaming) ? (
          <BuilderAssistantMessage
            text={raw}
            streaming={streaming}
            meta={buildMeta}
            plan={
              buildPlan ?? {
                summary: buildMeta?.summary ?? "Building your app",
                architecture: null,
                iconConcept: null,
                phases: [],
                taskLabels: [
                  "Planning",
                  "App identity",
                  "Data model",
                  "Screens",
                  "Actions",
                  "Preview polish",
                ],
              }
            }
            progressIndex={progressIndex}
            creditsUsed={creditsUsed}
            buildFinalized={!streaming}
          />
        ) : (
          <div className="rounded-xl bg-surface/80 px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground ring-1 ring-border/50">
            {text}
          </div>
        )}
        {planFooter}
      </DreamOSMessageShell>
    </motion.div>
  );
}

const MODE_STYLE = {
  discuss: {
    composerWrap:
      "composer-shell border border-border/70 bg-surface shadow-sm transition-colors focus-within:border-accent/35",
    badge: null,
  },
  edit: {
    composerWrap:
      "composer-shell border border-amber-500/25 bg-surface shadow-sm transition-colors focus-within:border-amber-400/40",
    badge: { label: "Surgical Edit", color: "bg-amber-500/10 text-amber-600 ring-amber-500/25" },
  },
  build: {
    composerWrap:
      "composer-shell border border-violet-500/25 bg-surface shadow-sm transition-colors focus-within:border-violet-400/40",
    badge: null,
  },
} satisfies Record<
  string,
  { composerWrap: string; badge: { label: string; color: string } | null }
>;

export interface ImmersiveWorkspaceProps {
  initialPrompt?: string;
  initialMode?: CreationMode;
  initialAutoStart?: boolean;
  initialBuildStrategy?: BuildStrategy;
  initialModelId?: string;
  initialJobId?: string;
  initialConversationId?: string;
  project?: CreateWorkspaceProject | null;
  onComposerReadyChange?: (ready: boolean) => void;
}

export function ImmersiveWorkspace({
  initialPrompt = "",
  initialMode = "build",
  initialAutoStart = false,
  initialBuildStrategy = "build_now",
  initialModelId,
  initialJobId,
  initialConversationId,
  project = null,
  onComposerReadyChange,
}: ImmersiveWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useClientSearchParams();
  const authReturnTo = React.useMemo(() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname || "/create";
  }, [pathname, searchParams]);
  const supabase = createClient();
  const { profile, user } = useAuthStore();
  const uid = user?.id ?? profile?.id;
  const {
    remaining,
    isConfirmed: creditsConfirmed,
    resetAt,
    syncFromDB,
    build: buildCredits,
    action: actionCredits,
    planId: creditsPlanId,
    loading: creditsLoading,
  } = useCreditsStore();
  const hydrated = useHydrated();
  const debugEnabled = isSubmitDebugEnabled(
    searchParams,
    profile?.email ?? user?.email ?? null,
  );

  const [composerLiveText, setComposerLiveText] = React.useState(initialPrompt);
  const [composerReady, setComposerReady] = React.useState(false);
  const input = composerLiveText;
  const setInput = setComposerLiveText;
  const composerLiveTextRef = React.useRef(composerLiveText);
  composerLiveTextRef.current = composerLiveText;
  const [mode, setMode] = React.useState<CreationMode>(initialMode);
  const [modelId, setModelId] = React.useState(initialModelId ?? "automatic");
  const [buildStrategy, setBuildStrategy] = React.useState<BuildStrategy>(initialBuildStrategy);
  const buildStrategyRef = React.useRef<BuildStrategy>(initialBuildStrategy);
  buildStrategyRef.current = buildStrategy;
  const [scope, setScope] = React.useState<EditScope | null>(null);
  const [editTarget, setEditTarget] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [creditError, setCreditError] = React.useState(false);
  const [creditBlockedZero, setCreditBlockedZero] = React.useState(false);
  const [buildRunSummary, setBuildRunSummary] = React.useState<{
    variant: "completed" | "partial" | "failed";
    status?: WorkflowRunStatus;
    headline?: string;
    bodyLines?: string[];
    creditsUsed?: number;
    remainingSummary?: string;
    errorMessage?: string;
    failureCode?: string;
    refunded?: boolean;
    showRefundLine?: boolean;
    showRepairActions?: boolean;
    showPreviewActions?: boolean;
    showContinueGeneration?: boolean;
  } | null>(null);
  const safeInitialConversationId =
    initialConversationId && isUuid(initialConversationId)
      ? initialConversationId
      : null;
  const [conversationId, setConversationId] = React.useState<string | null>(
    safeInitialConversationId,
  );
  const [localProjectId, setLocalProjectId] = React.useState<string | null>(null);
  const [autoStartFailed, setAutoStartFailed] = React.useState<string | null>(null);
  const autoStartedRef = React.useRef(false);
  const autostartConsumedRef = React.useRef(false);
  const convHydratedRef = React.useRef<string | null>(null);
  const userPinnedScrollRef = React.useRef(false);
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false);
  const tabFromUrl = searchParams.get("tab");
  const sectionFromUrl = searchParams.get("section");
  const dashboardSectionsFromUrl: DashSection[] = [
    "overview",
    "publish",
    "integrations",
    "secrets",
    "users",
    "data",
    "analytics",
    "payments",
    "domains",
    "security",
    "auth",
    "code",
    "template",
    "settings",
  ];
  const resolvedDashboardSection: DashSection =
    sectionFromUrl && dashboardSectionsFromUrl.includes(sectionFromUrl as DashSection)
      ? (sectionFromUrl as DashSection)
      : "overview";
  const resolvedRightTab: WorkspaceRightTab =
    tabFromUrl === "code" ||
    tabFromUrl === "dashboard" ||
    tabFromUrl === "preview" ||
    tabFromUrl === "mobile"
      ? tabFromUrl
      : sectionFromUrl && dashboardSectionsFromUrl.includes(sectionFromUrl as DashSection)
        ? "dashboard"
        : "preview";
  const [rightTab, setRightTab] = React.useState<WorkspaceRightTab>(resolvedRightTab);
  React.useEffect(() => {
    setRightTab(resolvedRightTab);
  }, [resolvedRightTab]);
  type MobileCreatePanel = "chat" | WorkspaceRightTab;
  const [mobilePanel, setMobilePanel] = React.useState<MobileCreatePanel>("chat");
  const lastSubmitFingerprintRef = React.useRef<{ text: string; at: number } | null>(null);
  const pendingOperationIdRef = React.useRef<string | null>(null);
  const [dashboardSection, setDashboardSection] = React.useState<DashSection>(resolvedDashboardSection);
  const [versionDrawerOpen, setVersionDrawerOpen] = React.useState(false);
  const insertPromptConsumedRef = React.useRef(false);
  const [pendingInsertAutoSubmit, setPendingInsertAutoSubmit] = React.useState<string | null>(null);
  const [secretsChatPanelOpen, setSecretsChatPanelOpen] = React.useState(false);
  const secretsHelperPendingPanelRef = React.useRef(false);
  const [lastSubmitAt, setLastSubmitAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    const section = searchParams.get("section");
    if (!section) return;
    if (!dashboardSectionsFromUrl.includes(section as DashSection)) return;
    setDashboardSection(section as DashSection);
    setRightTab("dashboard");
  }, [searchParams]);

  const applyBuilderSectionTarget = React.useCallback(
    (target: BuilderSectionTarget) => {
      const tabMap: Partial<Record<BuilderSectionTarget, WorkspaceRightTab>> = {
        "builder.chat": "preview",
        "builder.preview": "preview",
        "builder.code": "code",
        "builder.mobile": "mobile",
        "builder.dashboard.overview": "dashboard",
        "builder.dashboard.deploy": "dashboard",
        "builder.dashboard.integrations": "dashboard",
        "builder.dashboard.secrets": "dashboard",
        "builder.dashboard.payments": "dashboard",
        "builder.dashboard.auth": "dashboard",
        "builder.dashboard.settings": "dashboard",
        "builder.publish": "dashboard",
        "builder.diagnostics": "dashboard",
        "builder.versions": "code",
      };
      const sectionMap: Partial<Record<BuilderSectionTarget, DashSection>> = {
        "builder.dashboard.overview": "overview",
        "builder.dashboard.deploy": "publish",
        "builder.dashboard.integrations": "integrations",
        "builder.dashboard.secrets": "secrets",
        "builder.dashboard.payments": "payments",
        "builder.dashboard.auth": "auth",
        "builder.dashboard.settings": "settings",
        "builder.publish": "publish",
        "builder.diagnostics": "overview",
      };
      const nextTab = tabMap[target];
      if (nextTab) setRightTab(nextTab);
      const nextSection = sectionMap[target];
      if (nextSection) setDashboardSection(nextSection);
      if (target === "builder.versions") setVersionDrawerOpen(true);
      if (target === "builder.chat") setMobilePanel("chat");
    },
    [],
  );

  React.useEffect(() => {
    const repairPreview = searchParams.get("repair") === "preview";
    const raw = repairPreview
      ? "Fix the preview for this imported app. The iframe shows a 404 on the preview-html proxy path. Inspect routing, entry files, and base paths — update only what is needed so all routes load correctly inside the Vodex preview."
      : searchParams.get("insertPrompt");
    if (!raw?.trim() || insertPromptConsumedRef.current) return;
    insertPromptConsumedRef.current = true;
    let text = raw;
    try {
      text = decodeURIComponent(raw);
    } catch {
      /* use raw */
    }
    setMode(repairPreview ? "edit" : searchParams.get("mode") === "build" ? "build" : "discuss");
    setChatEngaged(true);
    setMobilePanel("chat");
    const autoSubmit = !repairPreview && (searchParams.get("autostart") === "1" || searchParams.get("autostart") === "true");
    if (autoSubmit) {
      setPendingInsertAutoSubmit(text);
    } else {
      setComposerLiveText(text);
      if (isSecretsHelperPrompt(text)) {
        toast.info("Secrets helper prompt added — press Send (~0.2 credits)");
      } else {
        toast.info("Prompt added to chat — review and press Submit");
      }
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("insertPrompt");
    next.delete("repair");
    next.delete("autostart");
    next.delete("mode");
    const qs = next.toString();
    const target = qs ? `${pathname}?${qs}` : pathname || "/create";
    replaceBrowserUrl(target);
  }, [pathname, searchParams]);
  const [lastApiUrl, setLastApiUrl] = React.useState<string | null>(null);
  const [lastApiStatus, setLastApiStatus] = React.useState<string | null>(null);
  const [editNeedsApp, setEditNeedsApp] = React.useState(false);
  const [submitBlocker, setSubmitBlocker] = React.useState<string | null>(null);
  const [emptyInputHint, setEmptyInputHint] = React.useState(false);
  const [sendCooldownUntil, setSendCooldownUntil] = React.useState(0);
  const [chatEngaged, setChatEngaged] = React.useState(false);
  const [pendingUserBubble, setPendingUserBubble] = React.useState<string | null>(null);
  const [showOptimisticAssistant, setShowOptimisticAssistant] = React.useState(false);
  /** Locked at submit — UI labels/billing follow this, not the mode tab. */
  const [lockedTaskMode, setLockedTaskMode] = React.useState<CreationMode | null>(null);
  const lastPlanPromptRef = React.useRef<string | null>(null);
  const [debugClicked, setDebugClicked] = React.useState(false);
  const [debugSubmitted, setDebugSubmitted] = React.useState(false);
  const [preflightState, setPreflightState] = React.useState("idle");
  const [chatState, setChatState] = React.useState("idle");
  const [debugBlocked, setDebugBlocked] = React.useState("no");
  const [submitStatusLabel, setSubmitStatusLabel] = React.useState("Ready");

  const composerRootRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const submitInFlightRef = React.useRef(false);
  useComposerClickCapture("create", composerRootRef);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const conversationIdRef = React.useRef<string | null>(safeInitialConversationId);
  conversationIdRef.current = conversationId;

  React.useEffect(() => {
    if (safeInitialConversationId) {
      setConversationId(safeInitialConversationId);
      conversationIdRef.current = safeInitialConversationId;
    }
  }, [safeInitialConversationId]);

  const projectIdRef = React.useRef<string | null>(null);
  const effectiveProjectId = localProjectId ?? project?.id ?? null;
  projectIdRef.current = effectiveProjectId;

  React.useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<BuilderSectionNavEvent>).detail;
      const pid = projectIdRef.current;
      if (!detail?.projectId || !pid) return;
      if (detail.projectId !== pid) return;
      applyBuilderSectionTarget(detail.target);
      replaceBrowserUrl(builderSectionPath(detail.projectId, detail.target));
    };
    window.addEventListener(BUILDER_SECTION_NAV_EVENT, onNav);
    return () => window.removeEventListener(BUILDER_SECTION_NAV_EVENT, onNav);
  }, [applyBuilderSectionTarget]);

  const [projectDataRefresh, setProjectDataRefresh] = React.useState(0);
  const {
    files: projectFiles,
    loading: projectFilesLoading,
  } = useProjectFiles(effectiveProjectId, projectDataRefresh, {
    loadContent: rightTab === "code",
  });
  const [prepareImportBusy, setPrepareImportBusy] = React.useState(false);

  const [remoteProjectPatch, setRemoteProjectPatch] = React.useState<Partial<CreateWorkspaceProject>>({});

  React.useEffect(() => {
    setRemoteProjectPatch({});
  }, [project?.id]);

  const baseProject = React.useMemo((): CreateWorkspaceProject | null => {
    if (project) return project;
    if (!localProjectId) return null;
    return {
      id: localProjectId,
      name: "New app",
      preview_url: null,
      icon_url: null,
      gradient: "from-blue-500/20 via-indigo-500/10 to-violet-500/15",
      status: "building",
      framework: "nextjs",
      custom_domain: null,
      is_public: false,
      metadata: {},
      published_subdomain: null,
    };
  }, [project, localProjectId]);

  const effectiveProject = React.useMemo((): CreateWorkspaceProject | null => {
    if (!baseProject) return null;
    return { ...baseProject, ...remoteProjectPatch };
  }, [baseProject, remoteProjectPatch]);

  React.useEffect(() => {
    if (project?.id) setLocalProjectId(null);
  }, [project?.id]);

  React.useEffect(() => {
    const meta = effectiveProject?.metadata as Record<string, unknown> | undefined;
    const stored = meta?.approved_blueprint;
    if (stored && typeof stored === "object") {
      approvedBlueprintRef.current = stored as Record<string, unknown>;
      blueprintApprovedRef.current = true;
      setBlueprintApproved(true);
      setBlueprint(stored as AppBlueprint);
    }
  }, [effectiveProject?.id, effectiveProject?.metadata]);
  const modeRef = React.useRef(mode);
  const lockedTaskModeRef = React.useRef<CreationMode | null>(null);
  const scopeRef = React.useRef<EditScope | null>(scope);
  const editTargetRef = React.useRef<string | null>(null);
  modeRef.current = mode;
  lockedTaskModeRef.current = lockedTaskMode ?? mode;
  scopeRef.current = scope;
  editTargetRef.current = editTarget;

  const modelIdRef = React.useRef(modelId);
  modelIdRef.current = modelId;

  /** Stable for component lifetime — never tie to conversationId or send wipes mid-flight. */
  const createSessionId = React.useId();

  const transport = React.useMemo(
    () =>
      createDreamChatTransport({
        label: "create",
        getBody: () => {
          const taskMode = lockedTaskModeRef.current ?? modeRef.current;
          return {
          modelId: modelIdRef.current,
          mode: taskMode,
          mode_at_submit: taskMode,
          strategy: taskMode === "build" ? buildStrategyRef.current : undefined,
          scope: scopeRef.current ?? undefined,
          editTarget: editTargetRef.current ?? undefined,
          projectId: projectIdRef.current ?? undefined,
          conversationId: conversationIdRef.current ?? undefined,
          operationId: pendingOperationIdRef.current ?? undefined,
          idempotencyKey: pendingOperationIdRef.current ?? undefined,
          approvedBlueprint: approvedBlueprintRef.current ?? undefined,
          planFirstOnly:
            buildStrategyRef.current === "plan_first" &&
            !blueprintApprovedRef.current &&
            taskMode === "build",
        };
        },
        on402: () => setCreditError(true),
        onSuccess: () => setCreditError(false),
        onFetchStart: (url) => {
          setLastApiUrl(url);
          setLastApiStatus("pending");
          setChatState("pending");
          submitDebug("create", "fetch start", { url });
        },
        onFetchEnd: (status) => {
          const label = String(status);
          setLastApiStatus(label);
          setChatState(label.startsWith("blocked") ? "error" : "ok");
          if (typeof status === "number" && status >= 400) {
            unlockStream();
          }
          uiSubmitLog("create", `chat status ${status}`);
          submitDebug("create", "response status", { status });
        },
      }),
    [],
  );

  const streamActiveRef = React.useRef(false);
  const [streamActive, setStreamActive] = React.useState(false);
  const buildJobActiveRef = React.useRef(false);
  const [activeBuildJob, setActiveBuildJob] = React.useState<{
    jobId: string;
    eventsUrl: string;
    operationId: string;
  } | null>(null);
  const [ownerDiagOpen, setOwnerDiagOpen] = React.useState(false);
  const [ownerDiagPayload, setOwnerDiagPayload] = React.useState<
    import("@/lib/build/build-diagnostics").BuildDiagnosticsPayload | null
  >(null);

  React.useEffect(() => {
    const jobId = initialJobId ?? searchParams.get("jobId");
    const pid = effectiveProjectId;
    if (!jobId || !pid || activeBuildJob) return;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("build_jobs")
        .select("status")
        .eq("id", jobId)
        .eq("project_id", pid)
        .maybeSingle();
      if (cancelled) return;
      const st = data?.status ?? null;
      if (st === "running") {
        buildJobActiveRef.current = true;
        setActiveBuildJob({
          jobId,
          eventsUrl: `/api/projects/${pid}/build-jobs/${jobId}/events`,
          operationId: `url-job:${jobId}`,
        });
        setChatEngaged(true);
      } else {
        buildJobActiveRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume running job from URL once
  }, [initialJobId, effectiveProjectId, searchParams, activeBuildJob, supabase]);

  type PromptQueueItem = {
    id: string;
    text: string;
    status: "queued" | "paused";
    createdAt: number;
    mode: "discuss" | "edit" | "build";
  };
  const promptQueueRef = React.useRef<PromptQueueItem[]>([]);
  const lastEnqueueFingerprintRef = React.useRef<{ text: string; at: number } | null>(null);
  const [queueCount, setQueueCount] = React.useState(0);
  const [queuedPrompts, setQueuedPrompts] = React.useState<PromptQueueItem[]>([]);
  const handoffProjectKeyRef = React.useRef<string | null>(null);
  const [buildStarting, setBuildStarting] = React.useState(false);
  const buildStartedAtRef = React.useRef<number | null>(null);
  const [preflightEstimate, setPreflightEstimate] = React.useState<{
    credits: number;
    creditsMax: number;
    modelId: string;
    provider: string;
  } | null>(null);
  const [lastMessageCost, setLastMessageCost] = React.useState<{
    state: "pending" | "final" | "finalizing";
    credits: number;
  } | null>(null);
  const [assistantMessageCosts, setAssistantMessageCosts] = React.useState<
    Record<string, { state: "pending" | "final" | "finalizing"; credits: number }>
  >({});
  const [frozenBuildWorkflow, setFrozenBuildWorkflow] =
    React.useState<BuildJobPollState | null>(null);
  const activeBuildPromptRef = React.useRef<string>("");
  const [pendingDiffRefresh, setPendingDiffRefresh] = React.useState(0);
  const [histLoading, setHistLoading] = React.useState(false);
  const [postBuildActive, setPostBuildActive] = React.useState(false);
  const [qualityRepairing, setQualityRepairing] = React.useState(false);
  const [blueprint, setBlueprint] = React.useState<AppBlueprint | null>(null);
  const [blueprintOpen, setBlueprintOpen] = React.useState(false);
  const [blueprintLoading, setBlueprintLoading] = React.useState(false);
  const [blueprintApproved, setBlueprintApproved] = React.useState(false);
  const blueprintApprovedRef = React.useRef(false);
  const pendingBuildTextRef = React.useRef<string | null>(null);
  const approvedBlueprintRef = React.useRef<Record<string, unknown> | null>(null);
  const [intentPreview, setIntentPreview] = React.useState<CreateIntentResult | null>(null);
  const [intentLoading, setIntentLoading] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [publishDraft, setPublishDraft] = React.useState<PublishUiState | null>(null);
  const [publishReady, setPublishReady] = React.useState(false);
  const [_publishPhase, setPublishPhase] = React.useState<PublishUiPhase>("idle");

  React.useEffect(() => {
    const meta = effectiveProject?.metadata;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      setPublishDraft(null);
      return;
    }
    const pu = (meta as Record<string, unknown>).publish_ui;
    if (pu && typeof pu === "object" && !Array.isArray(pu)) {
      setPublishDraft(pu as PublishUiState);
    }
  }, [effectiveProject?.metadata]);

  React.useEffect(() => {
    const id = effectiveProjectId;
    if (!id) {
      setPublishReady(false);
      return;
    }
    let cancelled = false;
    void fetch(`/api/projects/${id}/publish/readiness`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { artifactsReady?: boolean; canPublishWeb?: boolean } | null) => {
        if (!cancelled) setPublishReady(Boolean(data?.artifactsReady ?? data?.canPublishWeb));
      })
      .catch(() => {
        if (!cancelled) setPublishReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectId, projectDataRefresh]);

  React.useEffect(() => {
    const text = input.trim();
    if (text.length < 8) {
      setIntentPreview(null);
      return;
    }
    const t = setTimeout(() => {
      setIntentLoading(true);
      fetch("/api/projects/classify-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, projectId: effectiveProjectId }),
      })
        .then((r) => r.json())
        .then((data) => setIntentPreview(data as CreateIntentResult))
        .catch(() => setIntentPreview(null))
        .finally(() => setIntentLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [input, effectiveProjectId]);

  const unlockStream = React.useCallback(() => {
    streamActiveRef.current = false;
    setStreamActive(false);
  }, []);

  const clearBuildJob = React.useCallback(() => {
    buildJobActiveRef.current = false;
    setActiveBuildJob(null);
    if (projectIdRef.current) clearWorkspaceTask(projectIdRef.current);
  }, []);

  React.useEffect(() => {
    const pid = effectiveProjectId;
    if (!pid) return;
    const cached = readWorkspaceTask(pid);
    if (cached?.buildJobId && cached.eventsUrl) {
      buildJobActiveRef.current = true;
      setActiveBuildJob((prev) =>
        prev ?? {
          jobId: cached.buildJobId!,
          eventsUrl: cached.eventsUrl!,
          operationId: cached.operationId ?? "",
        },
      );
      if (cached.lockedMode) {
        setLockedTaskMode(cached.lockedMode);
        lockedTaskModeRef.current = cached.lockedMode;
      }
      if (cached.buildStartedAtMs) buildStartedAtRef.current = cached.buildStartedAtMs;
    }
  }, [effectiveProjectId]);

  React.useEffect(() => {
    const pid = effectiveProjectId;
    if (!pid) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${pid}/active-build`, { credentials: "include" });
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as {
          ok?: boolean;
          active?: boolean;
          job?: {
            id: string;
            events_url: string;
            prompt?: string | null;
            mode_at_submit?: string | null;
            conversation_id?: string | null;
          };
        };
        if (!body.active || !body.job?.id || cancelled) return;
        buildJobActiveRef.current = true;
        setActiveBuildJob((prev) => {
          if (prev?.jobId === body.job!.id) return prev;
          return {
            jobId: body.job!.id,
            eventsUrl: body.job!.events_url,
            operationId: prev?.operationId ?? `resume:${body.job!.id}`,
          };
        });
        if (body.job.mode_at_submit === "discuss" || body.job.mode_at_submit === "edit" || body.job.mode_at_submit === "build") {
          setLockedTaskMode(body.job.mode_at_submit);
          lockedTaskModeRef.current = body.job.mode_at_submit;
        }
        if (body.job.prompt?.trim()) {
          setInput((prev) => (prev.trim() ? prev : body.job!.prompt!.trim()));
        }
        persistWorkspaceTask({
          projectId: pid,
          buildJobId: body.job.id,
          eventsUrl: body.job.events_url,
          lockedMode:
            body.job.mode_at_submit === "discuss" ||
            body.job.mode_at_submit === "edit" ||
            body.job.mode_at_submit === "build"
              ? body.job.mode_at_submit
              : undefined,
        });
      } catch {
        /* session cache fallback only */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveProjectId]);

  const drainPromptQueueRef = React.useRef<() => void>(() => {});
  const pipelineBusyForQueueRef = React.useRef(false);
  const loadBlueprintRef = React.useRef<(text: string) => Promise<void>>(() => Promise.resolve());

  const { messages, sendMessage, status, error, clearError, regenerate, setMessages, stop } = useChat({
    id: `dream-create-${createSessionId}`,
    transport,
    onError: (err) => {
      unlockStream();
      const userMsg = sanitizeUserFacingAiError(err.message ?? "Generation failed");
      pushRuntimeDiagnostic("stream_failed", {
        message: userMsg,
        projectId: projectIdRef.current,
        conversationId: conversationIdRef.current,
      });
      if (process.env.NODE_ENV !== "production") {
        console.error("[create-workspace] stream error", err);
      }
      toast.error(
        userMsg.includes("network") || userMsg.includes("fetch") || userMsg.includes("Connection")
          ? `${userMsg} — check connection and retry. Credits are not charged until success.`
          : `${userMsg} — try again.`,
      );
      setSubmitStatusLabel(`Failed: ${userMsg}`);
      setTimeout(() => drainPromptQueueRef.current(), 300);
    },
    onFinish: () => {
      pushRuntimeDiagnostic("stream_finished", {
        projectId: projectIdRef.current,
        conversationId: conversationIdRef.current,
      });
      setLockedTaskMode(null);
      if (lastPlanPromptRef.current) {
        void loadBlueprintRef.current(lastPlanPromptRef.current);
        lastPlanPromptRef.current = null;
      }
      if (mode === "build" && blueprintApprovedRef.current) setPostBuildActive(true);
      if (mode === "edit") setPendingDiffRefresh((k) => k + 1);
      unlockStream();
      setLastMessageCost({ state: "pending", credits: 0 });
      const beforeCredits = useCreditsStore.getState().remaining;
      const pid = projectIdRef.current;
      if (pid) invalidateProjectFilesCache(pid);

      const finishCreditsAndStatus = async () => {
        let buildNeedsRepair = false;
        let creditsRefundedFlag = false;
        if (uid && pid) {
          await reconcileProjectBuildState(supabase, pid, uid);
          await repairPersistedBuildStateTruth(pid);
          if (mode === "build") {
            const { data: proj } = await supabase
              .from("projects")
              .select("build_status, metadata")
              .eq("id", pid)
              .maybeSingle();
            const meta =
              proj?.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
                ? (proj.metadata as Record<string, unknown>)
                : {};
            creditsRefundedFlag = meta.credits_refunded === true;
            const fileCountForRepair = projectFiles.length;
            buildNeedsRepair =
              proj?.build_status === "needs_repair" && fileCountForRepair < 4;
          }
        }

        if (uid) {
          await refreshCredits({ reason: "charge" });
          const after = useCreditsStore.getState().remaining;
          const delta = Math.max(0, beforeCredits - after);
          if (buildNeedsRepair) {
            const fileCount = projectFiles.length;
            const facts = deriveBuildStatusFacts({
              terminal: null,
              projectFileCount: fileCount,
            });
            facts.failureKind = fileCount > 0 ? "repair_needed" : "failed_before_generation";
            facts.hasFiles = fileCount > 0;
            facts.fileCount = fileCount;
            facts.creditsRefunded = creditsRefundedFlag;
            facts.terminalStatus = "failed";
            const resolved = resolveBuildRunSummary({
              facts,
              appName: project?.name ?? undefined,
              filesCount: fileCount,
              errorDetail: undefined,
            });
            setBuildRunSummary({
              variant: resolved.variant,
              status: resolved.status,
              headline: resolved.headline,
              bodyLines: resolved.bodyLines,
              showRefundLine: resolved.showRefundLine,
              showRepairActions: resolved.showRepairActions,
              showPreviewActions: resolved.showPreviewActions,
              showContinueGeneration: resolved.showContinueGeneration,
              refunded: resolved.showRefundLine,
            });
            setSubmitStatusLabel(resolved.headline);
            setLastMessageCost({ state: "final", credits: 0 });
          } else {
            setSubmitStatusLabel("Done");
            setLastMessageCost({ state: "final", credits: delta });
          }
          if (process.env.NODE_ENV !== "production") {
            submitDebug("create", "stream done", {
              creditsBefore: beforeCredits,
              creditsAfter: after,
              buildNeedsRepair,
            });
          }
        } else {
          setSubmitStatusLabel(buildNeedsRepair ? "Needs repair" : "Done");
          setLastMessageCost(null);
        }
        setTimeout(() => drainPromptQueueRef.current(), 400);
      };

      setProjectDataRefresh((n) => n + 1);
      void finishCreditsAndStatus().then(() => {
        setProjectDataRefresh((n) => n + 1);
      });
    },
  });

  const visibleMessages = React.useMemo(() => {
    const out: typeof messages = [];
    for (const m of messages) {
      const prev = out[out.length - 1];
      if (
        m.role === "user" &&
        prev?.role === "user" &&
        messageText(m).trim() === messageText(prev).trim()
      ) {
        continue;
      }
      out.push(m);
    }
    return out;
  }, [messages]);

  React.useEffect(() => {
    if (status === "ready" || status === "error") unlockStream();
  }, [status, unlockStream]);

  React.useEffect(() => {
    if (!streamActive) return;
    const t = setTimeout(() => {
      unlockStream();
      submitDebug("create", "stream safety unlock");
    }, 300_000);
    return () => clearTimeout(t);
  }, [streamActive, unlockStream]);

  const applyTerminalBuildSummary = React.useCallback(
    (terminal: BuildJobPollState, fileCountHint = 0) => {
      const facts = deriveBuildStatusFacts({
        terminal,
        projectFileCount: fileCountHint,
      });
      const meta = (terminal.latest?.metadata ?? {}) as Record<string, unknown>;
      const sourceIntegrityOk = meta.source_integrity_ok === true;
      const previewRenderable = meta.preview_renderable === true;
      const previewReady =
        sourceIntegrityOk &&
        previewRenderable &&
        (terminal.status === "completed" || meta.ready_reason === "source_integrity_ok_preview_live");
      const uiRichnessPasses = meta.ui_richness_passes !== false;
      const resolved = resolveBuildRunSummary({
        facts,
        appName: project?.name ?? undefined,
        filesCount: facts.fileCount,
        workflowEvents: terminal.events ?? [],
        creditsUsed:
          typeof terminal.latest?.metadata?.credits_used === "number"
            ? terminal.latest.metadata.credits_used
            : undefined,
        errorDetail: terminal.error ?? terminal.latest?.detail ?? undefined,
        previewReady,
        uiRichnessPasses,
        sourceIntegrityOk,
        persistenceConfirmed:
          facts.fileCount >= 4 ||
          meta.files_persist_confirmed === true ||
          meta.source_integrity_ok === true,
      });
      const summary = resolved;
      setBuildRunSummary({
        variant: summary.variant,
        status: summary.status,
        headline: summary.headline,
        bodyLines: summary.bodyLines,
        creditsUsed:
          typeof terminal.latest?.metadata?.credits_used === "number"
            ? terminal.latest.metadata.credits_used
            : undefined,
        remainingSummary: terminal.latest?.detail ?? undefined,
        errorMessage: terminal.error ?? terminal.latest?.detail ?? undefined,
        failureCode:
          (typeof meta.preview_failure_code === "string" && meta.preview_failure_code) ||
          (typeof meta.preview_error_code === "string" && meta.preview_error_code) ||
          (typeof meta.code === "string" && meta.code) ||
          undefined,
        refunded: summary.showRefundLine,
        showRefundLine: summary.showRefundLine,
        showRepairActions: summary.showRepairActions,
        showPreviewActions: summary.showPreviewActions,
        showContinueGeneration: summary.showContinueGeneration,
      });
      setSubmitStatusLabel(
        summary.status === "partial_credit_stop"
          ? "Partial save — add credits to continue"
          : summary.status === "completed"
            ? "Done"
            : summary.headline,
      );
    },
    [project?.name],
  );

  const buildJobProgressRef = React.useRef<BuildJobPollState | null>(null);

  const buildJobProgress = useBuildJobProgress(
    activeBuildJob ? { jobId: activeBuildJob.jobId, eventsUrl: activeBuildJob.eventsUrl } : null,
    React.useCallback(
      (terminal: BuildJobPollState) => {
        if (buildJobProgressRef.current) {
          setFrozenBuildWorkflow({ ...buildJobProgressRef.current, done: true });
        }
        clearBuildJob();
        setLockedTaskMode(null);
        setProjectDataRefresh((n) => n + 1);
        const pid = projectIdRef.current;
        if (pid) invalidateProjectFilesCache(pid);
        const eventWritten = (terminal.events ?? []).filter((e) => e.type === "writing_file").length;
        let terminalFiles =
          typeof terminal.latest?.metadata?.file_count === "number"
            ? terminal.latest.metadata.file_count
            : typeof terminal.latest?.metadata?.files_persisted === "number"
              ? terminal.latest.metadata.files_persisted
              : projectFiles.length;
        terminalFiles = Math.max(terminalFiles, eventWritten, projectFiles.length);
        for (const e of terminal.events ?? []) {
          const m = e.detail?.match(/(\d+)\s+files in memory/i);
          if (m) terminalFiles = Math.max(terminalFiles, Number(m[1]));
        }
        applyTerminalBuildSummary(terminal, terminalFiles);
        let creditsFromJob = 0;
        for (const e of terminal.events ?? []) {
          const charged = e.metadata?.credits_charged;
          if (typeof charged === "number" && charged > creditsFromJob) {
            creditsFromJob = charged;
          }
        }
        const creditsBeforeRefresh = useCreditsStore.getState().remaining;
        setLastMessageCost({
          state: "final",
          credits: creditsFromJob,
        });
        if (uid) {
          void refreshCredits({ reason: "charge" }).then(() => {
            const after = useCreditsStore.getState().remaining;
            const delta = Math.max(0, creditsBeforeRefresh - after);
            setLastMessageCost({
              state: "final",
              credits: creditsFromJob > 0 ? creditsFromJob : delta,
            });
          });
        }
        if (conversationIdRef.current) {
          void supabase
            .from("messages")
            .select("id, role, content, created_at, model_id, credits_used, metadata")
            .eq("conversation_id", conversationIdRef.current)
            .order("created_at", { ascending: true })
            .then(({ data }) => {
              if (!data?.length) return;
              const costFromDb: Record<
                string,
                { state: "final"; credits: number }
              > = {};
              for (const row of data) {
                if (row.role === "assistant" && typeof row.credits_used === "number") {
                  costFromDb[row.id] = { state: "final", credits: row.credits_used };
                }
              }
              setAssistantMessageCosts((prev) => ({ ...prev, ...costFromDb }));
              setMessages((prev) => {
                const fromDb = data.map((row) => ({
                  id: row.id,
                  role: row.role as "user" | "assistant",
                  parts: [{ type: "text" as const, text: row.content ?? "" }],
                }));
                const dbIds = new Set(fromDb.map((m) => m.id));
                const localQueued = prev.filter(
                  (m) => typeof m.id === "string" && m.id.startsWith("queue-"),
                );
                const keepLocal = localQueued.filter((m) => !dbIds.has(m.id));
                return [...fromDb, ...keepLocal];
              });
              setPendingUserBubble(null);
              submitInFlightRef.current = false;
              setBuildStarting(false);
            });
        }
        if (pid) clearWorkspaceTask(pid);
        if (pid && uid) {
          void reconcileProjectBuildState(supabase, pid, uid)
            .then(() => repairPersistedBuildStateTruth(pid))
            .then(() => {
              setProjectDataRefresh((n) => n + 1);
            });
        }
        setTimeout(() => drainPromptQueueRef.current(), 400);
      },
      [applyTerminalBuildSummary, clearBuildJob, projectFiles.length, setMessages, supabase, uid],
    ),
  );

  React.useEffect(() => {
    buildJobProgressRef.current = buildJobProgress;
  }, [buildJobProgress]);

  const isStreaming =
    (streamActive || status === "submitted" || status === "streaming") &&
    !buildJobActiveRef.current;
  const sendOnCooldown = Date.now() < sendCooldownUntil;
  const buildJobActive =
    activeBuildJob != null && (buildJobProgress == null || !buildJobProgress.done);
  const composerBlocked = preflightState === "pending";
  const composerTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [composerDomTick, setComposerDomTick] = React.useState(0);
  const [isComposing, setIsComposing] = React.useState(false);

  const applyComposerText = React.useCallback((next: string) => {
    setComposerLiveText((prev) => (prev === next ? prev : next));
    composerLiveTextRef.current = next;
    setComposerDomTick((t) => t + 1);
  }, []);

  const applyComposerTextRef = React.useRef(applyComposerText);
  applyComposerTextRef.current = applyComposerText;

  const composerListenerCleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(
    () => () => {
      composerListenerCleanupRef.current?.();
      setComposerReady(false);
    },
    [],
  );

  const resolveComposerTextareaEl = React.useCallback((): HTMLTextAreaElement | null => {
    if (composerTextareaRef.current) return composerTextareaRef.current;
    if (typeof document === "undefined") return null;
    return (
      (document.querySelector(
        '[data-testid="workspace-composer-textarea"]',
      ) as HTMLTextAreaElement | null) ??
      (document.getElementById("dreamos-composer-prompt") as HTMLTextAreaElement | null)
    );
  }, []);

  const syncFromDom = React.useCallback(() => {
    const el = resolveComposerTextareaEl();
    if (!el) return;
    const dom = el.value;
    const state = composerLiveTextRef.current;
    if (dom === state) return;
    // Controlled textarea: DOM can lag behind React state (E2E fill/type, hydration).
    if (!composerHasMeaningfulText(dom) && composerHasMeaningfulText(state)) return;
    applyComposerTextRef.current(dom);
  }, [resolveComposerTextareaEl]);

  React.useLayoutEffect(() => {
    syncFromDom();
  });

  React.useEffect(() => {
    syncFromDom();
    window.addEventListener("dreamos:composer-sync", syncFromDom);
    const id = window.setInterval(syncFromDom, 50);
    return () => {
      window.removeEventListener("dreamos:composer-sync", syncFromDom);
      window.clearInterval(id);
    };
  }, [syncFromDom]);

  const composerTextareaCallbackRef = React.useCallback((el: HTMLTextAreaElement | null) => {
    composerListenerCleanupRef.current?.();
    composerListenerCleanupRef.current = null;
    composerTextareaRef.current = el;
    if (!el) {
      setComposerReady(false);
      return;
    }
    const onDomInput = () => syncFromDom();
    syncFromDom();
    el.addEventListener("input", onDomInput);
    el.addEventListener("change", onDomInput);
    el.addEventListener("paste", onDomInput);
    el.addEventListener("focus", onDomInput);
    el.setAttribute("data-composer-handlers", "true");
    composerListenerCleanupRef.current = () => {
      el.removeEventListener("input", onDomInput);
      el.removeEventListener("change", onDomInput);
      el.removeEventListener("paste", onDomInput);
      el.removeEventListener("focus", onDomInput);
      el.removeAttribute("data-composer-handlers");
    };
    setComposerReady(true);
  }, [syncFromDom]);

  /** Cold hydration: ref callback can lag behind visible textarea — wire listeners once DOM exists. */
  React.useEffect(() => {
    if (!hydrated) return;
    const ensureComposerWired = () => {
      const el = resolveComposerTextareaEl();
      if (!el) return;
      if (composerTextareaRef.current !== el) {
        composerTextareaCallbackRef(el);
      } else {
        setComposerReady(true);
      }
    };
    ensureComposerWired();
    const id = window.setInterval(ensureComposerWired, 25);
    return () => window.clearInterval(id);
  }, [hydrated, composerTextareaCallbackRef, resolveComposerTextareaEl]);

  React.useEffect(() => {
    onComposerReadyChange?.(composerReady);
  }, [composerReady, onComposerReadyChange]);

  const resolvedTextareaEl = resolveComposerTextareaEl();
  const domText = resolvedTextareaEl?.value ?? "";
  const composerText = React.useMemo(() => {
    const resolved = getComposerText({
      stateText: composerLiveText,
      textareaEl: resolvedTextareaEl,
      formEl: formRef.current,
      fieldName: "composer-prompt",
    });
    if (composerHasMeaningfulText(resolved)) return resolved;
    if (composerHasMeaningfulText(composerLiveText)) return composerLiveText;
    return resolved;
  }, [composerLiveText, resolvedTextareaEl, composerDomTick]);
  void composerDomTick;
  const domLen = domText.length;
  const stateLen = composerLiveText.length;
  const liveLen = composerText.length;

  const handleComposerInputCapture = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      const target = e.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      if (target.name !== "composer-prompt") return;
      applyComposerText(target.value);
    },
    [applyComposerText],
  );

  const submitDisabledReason = React.useMemo(
    () =>
      resolveComposerSubmitDisabledReason({
        text: composerText,
        hydrated,
        userId: uid,
        creditError,
        creditsLoading,
        creditsConfirmed,
        buildCreditsAvailable: Math.max(0, buildCredits?.available ?? 0),
        buildJobActive,
        queueCount,
        queueMax: PROMPT_QUEUE_MAX,
        fatalError: creditError,
      }),
    [
      composerLiveText,
      composerText,
      hydrated,
      uid,
      creditError,
      creditsLoading,
      creditsConfirmed,
      buildCredits,
      buildJobActive,
      queueCount,
    ],
  );

  const composerHasText = composerHasMeaningfulText(composerText);
  const composerDomHasText = composerHasMeaningfulText(domText);
  const submitHardDisabled =
    submitDisabledReason === "auth" ||
    submitDisabledReason === "credits" ||
    submitDisabledReason === "queue_full" ||
    submitDisabledReason === "error";
  const canSendPrompt =
    !submitHardDisabled && (composerHasText || composerDomHasText);
  const resolveComposerPromptText = React.useCallback((): string => {
    const text = getComposerText({
      stateText: composerLiveText,
      textareaEl: resolveComposerTextareaEl(),
      formEl: formRef.current,
      fieldName: "composer-prompt",
    }).trim();
    if (composerHasMeaningfulText(text)) return text;
    const dom = (resolveComposerTextareaEl()?.value ?? "").trim();
    return composerHasMeaningfulText(dom) ? dom : text;
  }, [composerLiveText, resolveComposerTextareaEl, composerDomTick]);
  const planFirstEnabled =
    mode === "build" &&
    buildStrategy === "plan_first" &&
    !blueprintApproved &&
    !effectiveProjectId;
  const composerBuildStrategy =
    mode === "discuss" ? "discuss" : mode === "edit" ? "edit" : buildStrategy;
  const canEnqueueBuild =
    mode === "build" &&
    buildStrategy === "build_now" &&
    composerHasText &&
    !submitHardDisabled;
  const isBusy =
    isStreaming ||
    buildJobActive ||
    buildStarting ||
    preflightState === "pending" ||
    postBuildActive;

  React.useEffect(() => {
    const pid = effectiveProjectId;
    if (!pid || !postBuildActive) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const { data: job } = await supabase
        .from("build_jobs")
        .select("status, error_message")
        .eq("project_id", pid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const st = job?.status ?? null;
      setQualityRepairing(st === "repairing");
      if (
        st === "completed" ||
        st === "failed" ||
        st === "completed_with_errors" ||
        st === "succeeded" ||
        attempts >= 20
      ) {
        setPostBuildActive(false);
        setQualityRepairing(false);
        setProjectDataRefresh((n) => n + 1);
        return;
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [postBuildActive, effectiveProjectId, supabase]);

  React.useEffect(() => {
    const id = effectiveProjectId;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const { data, error: qErr } = await supabase
        .from("projects")
        .select(
          "id, name, preview_url, icon_url, gradient, status, framework, custom_domain, is_public, metadata, published_subdomain, app_name, build_status, short_description, category, icon_svg",
        )
        .eq("id", id)
        .maybeSingle();
      if (!cancelled && !qErr && data) {
        const patch = data as CreateWorkspaceProject & { app_name?: string | null };
        setRemoteProjectPatch({
          ...patch,
          name: resolveProjectDisplayName({
            app_name: patch.app_name,
            name: patch.name,
          }),
          icon_svg: patch.icon_svg,
          icon_url: patch.icon_url,
        });
        notifyProjectCatalogUpdated(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectId, supabase, projectDataRefresh]);

  React.useEffect(() => {
    const id = effectiveProjectId;
    if (!id || !uid || autostartConsumedRef.current || autoStartedRef.current) return;
    const key = `${id}:${uid}`;
    if (convHydratedRef.current === key) return;
    let cancelled = false;
    setHistLoading(true);
    void (async () => {
      const convId = await findProjectConversationId(supabase, uid, id);
      if (cancelled) return;
      convHydratedRef.current = key;
      if (convId) {
        setConversationId(convId);
        const { data: rows } = await supabase
          .from("messages")
          .select("id, role, content")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });
        if (!cancelled && rows && rows.length > 0) {
          setMessages((prev) => {
            if (prev.length > 0) {
              const seen = new Set(prev.map((m) => m.id));
              const merged = [...prev];
              for (const m of rows) {
                if (!seen.has(m.id)) {
                  merged.push({
                    id: m.id,
                    role: m.role as "user" | "assistant",
                    parts: [{ type: "text" as const, text: m.content }],
                  });
                }
              }
              return merged;
            }
            return rows.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text" as const, text: m.content }],
            }));
          });
        }
      }
      if (!cancelled) setHistLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectId, uid, supabase, setMessages]);

  React.useEffect(() => {
    submitDebug("create", "mounted");
    pushSubmitTrace("create", "ImmersiveWorkspace loaded — submit pipeline active", { level: "ok" });
  }, []);

  React.useEffect(() => {
    submitDebug("create", "mode changed", { mode });
    if (mode !== "edit") setEditNeedsApp(false);
  }, [mode]);

  const tokenBlocked = creditsConfirmed && remaining <= 0;

  const tokensStatus = !creditsConfirmed ? "loading" : tokenBlocked ? "blocked" : `${remaining}`;
  const planId = profile?.plan_id ?? "free";
  const nextPlanLabel = PLAN_NEXT_LABEL[planId] ?? "Starter";
  const showUpgradeCard = tokenBlocked && planId !== "enterprise";

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const buildStreamTick =
    buildJobProgress?.events?.length ??
    frozenBuildWorkflow?.events?.length ??
    0;
  const buildProgressPct = buildJobProgress?.progressPercent ?? frozenBuildWorkflow?.progressPercent ?? 0;

  React.useEffect(() => {
    if (userPinnedScrollRef.current) return;
    scrollToBottom(isBusy ? "auto" : "smooth");
  }, [messages, isBusy, scrollToBottom, buildStreamTick, buildProgressPct]);

  const onChatScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = dist > 96;
    userPinnedScrollRef.current = pinned;
    setShowJumpToLatest(pinned);
  }, []);

  React.useEffect(() => {
    if (rightTab === "dashboard" && !effectiveProject?.id) setRightTab("preview");
  }, [rightTab, effectiveProject?.id]);

  function failSubmit(blocked: string, message: string, hint?: string) {
    const full = hint ? `${message} — ${hint}` : message;
    setLastApiStatus(blocked);
    setSubmitBlocker(full);
    setDebugBlocked(blocked.replace(/^blocked:/, "") || "error");
    if (blocked.includes("preflight") || blocked.startsWith("blocked:")) {
      setPreflightState("error");
    }
    pushSubmitTrace("create", full, {
      level: "error",
      error: full,
      blocked: blocked.replace(/^blocked:/, "") || "error",
      preflight: blocked.includes("preflight") ? "error" : undefined,
      chat: blocked.includes("server") ? "error" : undefined,
    });
    toast.error(full);
    submitDebug("create", blocked, { message });
  }

  const onFiles = React.useCallback((files: File[]) => {
    const next: Attachment[] = files.map((f) => ({
      id: newAttachmentId(),
      kind: f.type.startsWith("image/") ? "image" : /\.zip$/i.test(f.name) ? "zip" : "file",
      name: f.name,
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      size: f.size,
      status: "ready" as const,
    }));
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  const removeAttachment = React.useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  function notifySubmitBlocked(reason: string) {
    setDebugBlocked(reason);
    if (reason === "empty") {
      setEmptyInputHint(true);
      window.setTimeout(() => setEmptyInputHint(false), 2000);
    }
  }

  function syncQueueState() {
    setQueuedPrompts([...promptQueueRef.current]);
    setQueueCount(promptQueueRef.current.filter((q) => q.status === "queued").length);
  }

  function enqueuePrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const activeQueued = promptQueueRef.current.filter((q) => q.status === "queued").length;
    if (activeQueued >= PROMPT_QUEUE_MAX) {
      toast.error(PROMPT_QUEUE_FULL_MESSAGE);
      return;
    }
    const dup = promptQueueRef.current.some((q) => q.text === trimmed && q.status === "queued");
    if (dup) return;
    const prev = lastEnqueueFingerprintRef.current;
    if (prev && prev.text === trimmed && Date.now() - prev.at < 2_500) return;
    lastEnqueueFingerprintRef.current = { text: trimmed, at: Date.now() };
    const item: PromptQueueItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      status: "queued",
      createdAt: Date.now(),
      mode: lockedTaskMode ?? mode,
    };
    promptQueueRef.current.push(item);
    syncQueueState();
    setMessages((prev) => [
      ...prev,
      {
        id: `queue-${item.id}`,
        role: "user" as const,
        parts: [{ type: "text" as const, text: trimmed }],
      },
    ]);
    applyComposerText("");
    if (composerTextareaRef.current) composerTextareaRef.current.value = "";
    if (!pipelineBusyForQueueRef.current) {
      setTimeout(() => drainPromptQueueRef.current(), 80);
    }
  }

  function cancelQueuedPrompt(id: string) {
    promptQueueRef.current = promptQueueRef.current.filter((q) => q.id !== id);
    syncQueueState();
  }

  function pauseQueuedPrompt(id: string) {
    promptQueueRef.current = promptQueueRef.current.map((q) =>
      q.id === id ? { ...q, status: "paused" as const } : q,
    );
    syncQueueState();
  }

  function resumeQueuedPrompt(id: string) {
    promptQueueRef.current = promptQueueRef.current.map((q) =>
      q.id === id ? { ...q, status: "queued" as const } : q,
    );
    syncQueueState();
  }

  function editQueuedPrompt(id: string, nextText: string) {
    promptQueueRef.current = promptQueueRef.current.map((q) =>
      q.id === id ? { ...q, text: nextText.trim() } : q,
    );
    syncQueueState();
  }

  async function loadBlueprint(text: string) {
    setBlueprintLoading(true);
    setBlueprintOpen(false);
    setSubmitStatusLabel("Preparing plan…");
    try {
      const res = await fetch("/api/build/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          modelId,
          projectId: effectiveProjectId,
          qualityLevel: "standard",
          mode: "llm_enriched",
          stylePresetId:
            (effectiveProject?.metadata as Record<string, unknown> | undefined)?.style_preset_id ??
            undefined,
          templateId:
            (effectiveProject?.metadata as Record<string, unknown> | undefined)?.template_id ??
            undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.blueprint) {
        setBlueprint(data.blueprint as AppBlueprint);
      } else {
        setBlueprint(null);
        toast.error(data.error ?? "Could not generate blueprint");
      }
    } finally {
      setBlueprintLoading(false);
    }
  }
  loadBlueprintRef.current = loadBlueprint;

  async function confirmBlueprintBuild() {
    if (!blueprint) return;
    if (!pendingBuildTextRef.current) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser) pendingBuildTextRef.current = messageText(lastUser);
    }
    let projectIdForBuild = effectiveProjectId;
    if (!projectIdForBuild) {
      const text = pendingBuildTextRef.current || blueprint.oneSentencePitch;
      const created = await fetch("/api/projects/create-from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, source: "blueprint" }),
      }).then((r) => r.json());
      if (!created.ok || !created.projectId) {
        toast.error(created.error ?? "Could not create project for build");
        return;
      }
      projectIdForBuild = created.projectId as string;
      setLocalProjectId(projectIdForBuild);
      projectIdRef.current = projectIdForBuild;
    }
    const res = await fetch("/api/build/blueprint", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprint, projectId: projectIdForBuild }),
    });
    if (res.ok) {
      const data = await res.json();
      approvedBlueprintRef.current = (data.blueprint ?? blueprint) as Record<string, unknown>;
      blueprintApprovedRef.current = true;
      setBlueprintApproved(true);
      setBuildStrategy("build_now");
      buildStrategyRef.current = "build_now";
      setBlueprintOpen(false);
    } else {
      toast.error("Could not save plan approval");
      return;
    }
    const text = pendingBuildTextRef.current;
    pendingBuildTextRef.current = null;
    if (text) await runSubmitRef.current("button", text, { forceBuild: true });
  }

  const runSubmit = React.useCallback(async (
    source: "button" | "enter" | "form" | "url-auto" = "button",
    overrideText?: string,
    options?: { queueOnly?: boolean; forceBuild?: boolean },
  ) => {
    setDebugClicked(true);
    setSubmitStatusLabel("Submit started");
    const text = (overrideText ?? resolveComposerPromptText()).trim();

    const pipelineBusy =
      streamActiveRef.current ||
      submitInFlightRef.current ||
      (activeBuildJob != null && (buildJobProgress == null || !buildJobProgress.done));
    if (pipelineBusy || options?.queueOnly) {
      if (!composerHasMeaningfulText(text)) {
        notifySubmitBlocked("empty");
        return;
      }
      if (promptQueueRef.current.filter((q) => q.status === "queued").length >= PROMPT_QUEUE_MAX) {
        toast.error(PROMPT_QUEUE_FULL_MESSAGE);
        return;
      }
      enqueuePrompt(text);
      applyComposerText("");
      if (composerTextareaRef.current) composerTextareaRef.current.value = "";
      setPendingUserBubble(null);
      return;
    }
    if (submitInFlightRef.current) {
      setSubmitStatusLabel("Submit already in progress");
      return;
    }
    setDebugSubmitted(true);
    uiSubmitLog("create", "handleSubmit start", { source });
    submitDebug("create", "handleSubmit start", { source });
    submitDebug("create", "submit guard check", { empty: !text, busy: isBusy, mode });

    if (!text) {
      setDebugBlocked("empty");
      notifySubmitBlocked("empty");
      return;
    }

    const wantsPublish =
      intentPreview?.intent === "publish_request" ||
      /\b(publish|deploy)\b/i.test(text);
    if (wantsPublish) {
      submitInFlightRef.current = false;
      setPendingUserBubble(null);
      setShowOptimisticAssistant(false);
      if (!effectiveProjectId) {
        toast.error("Open or create an app first, then publish from the builder.");
        return;
      }
      setPublishOpen(true);
      toast.info("Publish — we'll deploy when readiness checks pass.");
      return;
    }

    const now = Date.now();
    if (now < sendCooldownUntil) {
      return;
    }
    if (shouldSkipDuplicateClientSubmit(text, mode, effectiveProjectId)) {
      setSubmitStatusLabel("Skipped duplicate submit");
      return;
    }

    const prev = lastSubmitFingerprintRef.current;
    if (prev && prev.text === text && now - prev.at < SEND_COOLDOWN_MS) {
      pushRuntimeDiagnostic("prompt_submit_skipped_duplicate", { source, mode });
      return;
    }
    lastSubmitFingerprintRef.current = { text, at: now };

    if (isSecretsHelperPrompt(text)) {
      secretsHelperPendingPanelRef.current = true;
    }

    const projectIdempotencyKey =
      handoffProjectKeyRef.current ?? pendingOperationIdRef.current ?? crypto.randomUUID();
    const opId =
      source === "url-auto" && handoffProjectKeyRef.current
        ? handoffProjectKeyRef.current
        : crypto.randomUUID();
    handoffProjectKeyRef.current = null;
    pendingOperationIdRef.current = opId;
    if (wasOperationSubmitted(opId)) {
      pushRuntimeDiagnostic("prompt_submit_skipped_duplicate", { source, operationId: opId });
      setSubmitStatusLabel("Skipped duplicate submit");
      return;
    }
    markOperationSubmitted(opId);
    pushRuntimeDiagnostic("prompt_submit_started", { source, mode, operationId: opId });

    setChatEngaged(true);
    setPendingUserBubble(text);
    setShowOptimisticAssistant(true);
    applyComposerText("");
    if (composerTextareaRef.current) composerTextareaRef.current.value = "";
    setAttachments([]);

    submitInFlightRef.current = true;
    let submitModeEarly = mode;
    if (messages.length === 0 && mode !== "build" && !effectiveProjectId) {
      submitModeEarly = "build";
    }
    setLockedTaskMode(submitModeEarly);
    lockedTaskModeRef.current = submitModeEarly;
    setMode(submitModeEarly);
    if (submitModeEarly === "build") {
      setBuildStarting(true);
      buildStartedAtRef.current = Date.now();
      activeBuildPromptRef.current = text;
      setFrozenBuildWorkflow(null);
    } else {
      setBuildStarting(false);
    }
    const draft = text;
    setLastSubmitAt(Date.now());
    setSubmitBlocker(null);
    setDebugBlocked("no");
    setEditNeedsApp(false);
    clearError();
    submitDebug("create", "selected mode", { mode });

    if (mode === "edit" && projectFiles.length === 0 && parsedSourceFiles.length === 0) {
      failSubmit("edit_requires_files", "Generate your app first — Edit unlocks after files exist.");
      setSubmitStatusLabel("Edit requires generated files");
      setBuildStarting(false);
      submitInFlightRef.current = false;
      return;
    }

    if (messages.length === 0 && mode !== "build" && !effectiveProjectId) {
      setMode("build");
      failSubmit("first_prompt_build_only", "First prompt must use Build mode.");
      setSubmitStatusLabel("Use Build mode for your first prompt");
      setBuildStarting(false);
      submitInFlightRef.current = false;
      return;
    }

    try {
      let submitMode = mode;
      setLockedTaskMode(submitMode);
      lockedTaskModeRef.current = submitMode;
      const activeProjectId = projectIdRef.current ?? effectiveProjectId;
      const taskRoute = routeBuilderTask(text, {
        projectId: activeProjectId,
        hasFiles: codeFiles.length > 0 || projectFiles.length > 0,
        mode: submitMode,
      });

      if (taskRoute.route === "question_only") {
        submitMode = "discuss";
        setLockedTaskMode("discuss");
        setBuildStarting(false);
      } else if (
        activeProjectId &&
        (codeFiles.length > 0 || projectFiles.length > 0) &&
        (taskRoute.route === "project_edit" || taskRoute.route === "project_repair")
      ) {
        submitMode = "edit";
        setLockedTaskMode("edit");
        setMode("edit");
        if (buildStrategyRef.current === "plan_first") {
          buildStrategyRef.current = "build_now";
          setBuildStrategy("build_now");
        }
      }

      const isQuestion =
        taskRoute.route === "question_only" ||
        (!activeProjectId &&
          (intentPreview?.intent === "question_only" ||
            intentPreview?.shouldCreateProject === false ||
            intentPreview?.shouldAnswerQuestion));

      if (submitMode === "build" && isQuestion) {
        submitMode = "discuss";
        setLockedTaskMode("discuss");
        setBuildStarting(false);
      }
      const planFirstPlanning =
        buildStrategyRef.current === "plan_first" &&
        !blueprintApprovedRef.current &&
        options?.forceBuild !== true;

      if (activeProjectId) {
        projectIdRef.current = activeProjectId;
        pushRuntimeDiagnostic("project_reused", { projectId: activeProjectId, source });
      } else if (submitMode === "build" && !isQuestion && !planFirstPlanning) {
        const created = await fetch("/api/projects/create-from-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            source: "prompt",
            idempotencyKey: projectIdempotencyKey,
            sessionId: projectIdempotencyKey,
          }),
        }).then((r) => r.json());
        if (created.ok && created.projectId) {
          pushRuntimeDiagnostic("project_created", { projectId: created.projectId, source, operationId: opId });
          setLocalProjectId(created.projectId);
          projectIdRef.current = created.projectId;
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dreamos:projects-invalidate"));
            storeAutostartHandoff(text, "build", {
              buildStrategy: buildStrategyRef.current,
              modelId,
            });
          }
          // Defer URL replace until async build is enqueued — early navigation aborts submit.
        } else if (!created.ok && created.code === "question_only") {
          submitMode = "discuss";
          setLockedTaskMode("discuss");
          setBuildStarting(false);
        }
      } else if (planFirstPlanning) {
        pushRuntimeDiagnostic("project_create_deferred_plan_first", { operationId: opId });
      }

      setSubmitStatusLabel("Preflight started");
      setLastApiUrl("/api/ai/preflight");
      setLastApiStatus("preflight:pending");
      setPreflightState("pending");
      setChatState("idle");
      uiSubmitLog("create", "preflight fetch start");
      submitDebug("create", "preflight start");

      const pre = await runAiPreflightDeduped({
        mode: submitMode,
        prompt: text,
        projectId: projectIdRef.current ?? effectiveProjectId,
        conversationId: conversationIdRef.current,
        modelId,
      });

      uiSubmitLog("create", `preflight status ${pre.ok ? "ok" : pre.status}`, {
        code: pre.ok ? undefined : pre.code,
      });
      submitDebug("create", "preflight status", {
        ok: pre.ok,
        status: pre.ok ? 200 : pre.status,
        code: pre.ok ? undefined : pre.code,
      });

      if (!isAiPreflightSuccess(pre)) {
        setBuildStarting(false);
        setPreflightState("error");
        const blocked = preflightBlockedLabel(pre.code, pre.status);
        if (pre.code === "edit_no_app") setEditNeedsApp(true);
        if (pre.code === "blocked_zero_credits") {
          setCreditBlockedZero(true);
          setCreditError(true);
        } else if (pre.code === "insufficient_tokens") {
          setCreditError(true);
          setCreditBlockedZero(remaining <= 0);
        }
        const reason = `Preflight HTTP ${pre.status}${pre.code ? ` (${pre.code})` : ""}: ${pre.error}`;
        pushSubmitTrace("create", reason, {
          level: "error",
          error: pre.hint ? `${pre.error} — ${pre.hint}` : pre.error,
          preflight: "error",
          blocked: pre.code ?? String(pre.status),
        });
        failSubmit(blocked, pre.error, pre.hint);
        setSubmitStatusLabel(
          `Failed: Preflight HTTP ${pre.status}${pre.code ? ` (${pre.code})` : ""} — ${pre.hint ? `${pre.error} — ${pre.hint}` : pre.error}`,
        );
        return;
      }

      setPreflightState("ok");
      if (pre.creditsEstimate != null) {
        setPreflightEstimate({
          credits: pre.creditsEstimate,
          creditsMax: pre.creditsEstimateMax ?? pre.creditsEstimate,
          modelId: pre.modelId ?? modelId,
          provider: pre.provider ?? "auto",
        });
      }
      pushSubmitTrace("create", "Preflight OK — starting chat", { level: "ok", preflight: "ok" });

      if (pre.projectId) {
        if (!project?.id) setLocalProjectId(pre.projectId);
        projectIdRef.current = pre.projectId;
      }
      if (pre.conversationId) {
        conversationIdRef.current = pre.conversationId;
        setConversationId(pre.conversationId);
      }

      submitDebug("create", "payload ready", {
        mode,
        projectId: projectIdRef.current,
        conversationId: conversationIdRef.current,
      });

      if (planFirstPlanning) {
        lastPlanPromptRef.current = text;
      }

      const planOnlySubmit = submitMode === "build" && planFirstPlanning;
      if (planOnlySubmit) {
        setMessages((prev) => [
          ...prev,
          {
            id: `user-${opId}`,
            role: "user" as const,
            parts: [{ type: "text" as const, text }],
          },
        ]);
        applyComposerText("");
        if (composerTextareaRef.current) composerTextareaRef.current.value = "";
        setSubmitStatusLabel("Creating plan…");
        setLastApiUrl("/api/build/blueprint");
        setLastApiStatus("pending");
        await loadBlueprint(text);
        setLastApiStatus("ok");
        setSubmitStatusLabel("Plan ready");
        submitInFlightRef.current = false;
        setBuildStarting(false);
        return;
      }

      setSendCooldownUntil(Date.now() + SEND_COOLDOWN_MS);

      const asyncProjectId = projectIdRef.current ?? effectiveProjectId;
      const buildIntent = classifyBuildIntent(text);
      const wantsBuildPipeline =
        options?.forceBuild === true ||
        shouldStartBuildPipeline(submitMode, buildIntent);
      const useAsyncBuild =
        (submitMode === "build" || (submitMode === "edit" && taskRoute.route === "project_repair")) &&
        Boolean(asyncProjectId) &&
        wantsBuildPipeline &&
        !planFirstPlanning;

      if (useAsyncBuild && asyncProjectId) {
        setSubmitStatusLabel("Build queued");
        setLastApiUrl("/api/chat");
        setLastApiStatus("pending");
        const enqueued = await enqueueAsyncBuild({
          messages: [
            ...messages,
            {
              id: `pending-user-${opId}`,
              role: "user" as const,
              parts: [{ type: "text" as const, text }],
            },
          ],
          body: {
            modelId,
            mode: submitMode,
            mode_at_submit: submitMode,
            strategy: buildStrategyRef.current,
            forceBuildPipeline:
              options?.forceBuild === true || buildStrategyRef.current === "build_now",
            planFirstOnly: false,
            projectId: asyncProjectId,
            conversationId: conversationIdRef.current ?? undefined,
            operationId: opId,
            idempotencyKey: opId,
            approvedBlueprint: approvedBlueprintRef.current ?? undefined,
            scope: scope ?? undefined,
          },
        });
        if (enqueued.conversationId) {
          conversationIdRef.current = enqueued.conversationId;
          setConversationId(enqueued.conversationId);
        }
        buildJobActiveRef.current = true;
        const job = {
          jobId: enqueued.buildJobId!,
          eventsUrl: enqueued.eventsUrl!,
          operationId: enqueued.operationId ?? opId,
        };
        setActiveBuildJob(job);
        persistWorkspaceTask({
          projectId: asyncProjectId,
          buildJobId: job.jobId,
          eventsUrl: job.eventsUrl,
          operationId: job.operationId,
          lockedMode: submitMode,
          buildStartedAtMs: buildStartedAtRef.current ?? Date.now(),
        });
        setLastApiStatus("ok");
        setChatState("ok");
        setSubmitStatusLabel("Building in background…");
        setBuildStarting(false);
        submitInFlightRef.current = false;
        syncProjectIdInAddressBar(asyncProjectId, pathname);
        return;
      }

      if (projectIdRef.current && submitMode === "build") {
        syncProjectIdInAddressBar(projectIdRef.current, pathname);
      }

      setSubmitStatusLabel("Chat started");
      uiSubmitLog("create", "chat fetch start");
      setLastApiUrl("/api/chat");
      setLastApiStatus("pending");
      setChatState("pending");
      streamActiveRef.current = true;
      setStreamActive(true);
      setBuildStarting(false);
      await sendMessage({ text });
      setLastApiStatus((s) => (s === "pending" ? "ok" : s));
      setChatState("ok");
      submitDebug("create", "ui updated");
      setSubmitStatusLabel("Chat started (stream active)");
    } catch (err) {
      setBuildStarting(false);
      setLastApiStatus("error");
      setChatState("error");
      clearOperationSubmitted(opId);
      pendingOperationIdRef.current = null;
      const errCode = (err as Error & { code?: string }).code;
      if (errCode === "blocked_zero_credits") {
        setCreditBlockedZero(true);
        setCreditError(true);
      } else if (errCode === "insufficient_tokens") {
        setCreditError(true);
        setCreditBlockedZero(remaining <= 0);
      }
      const msg = err instanceof Error ? err.message : "Could not send message";
      failSubmit("blocked:server", msg);
      setSubmitStatusLabel(`Failed: ${msg}`);
      if (source === "url-auto") {
        setAutoStartFailed(msg);
        autoStartedRef.current = false;
      }
      if (source !== "url-auto") applyComposerText(draft);
    } finally {
      submitInFlightRef.current = false;
      if (!streamActiveRef.current) setBuildStarting(false);
    }
  }, [
    input,
    isBusy,
    mode,
    modelId,
    effectiveProjectId,
    project?.id,
    clearError,
    sendMessage,
    blueprintApproved,
    activeBuildJob,
    buildJobProgress,
    resolveComposerPromptText,
  ]);

  const runSubmitRef = React.useRef(runSubmit);
  runSubmitRef.current = runSubmit;

  const invokeAutostartSubmit = React.useCallback((source: "url-auto", text: string) => {
    const fn = runSubmitRef.current;
    if (typeof fn !== "function") {
      pushRuntimeDiagnostic("handoff_failed", { reason: "submit_not_ready" });
      setAutoStartFailed("Builder is still starting. Tap retry below.");
      autoStartedRef.current = false;
      autostartConsumedRef.current = false;
      return;
    }
    void fn(source, text).catch((err) => {
      autoStartedRef.current = false;
      autostartConsumedRef.current = false;
      pushRuntimeDiagnostic("handoff_failed", { reason: "autostart_submit_failed" });
      const msg = err instanceof Error ? err.message : "Could not start chat automatically.";
      setAutoStartFailed("Could not start automatically. Tap retry below.");
      toast.error(msg);
    });
  }, []);

  React.useEffect(() => {
    if (!hydrated || !pendingInsertAutoSubmit?.trim()) return;
    const text = pendingInsertAutoSubmit.trim();
    setPendingInsertAutoSubmit(null);
    setPendingUserBubble(text);
    setShowOptimisticAssistant(true);
    invokeAutostartSubmit("url-auto", text);
  }, [hydrated, pendingInsertAutoSubmit, invokeAutostartSubmit]);

  React.useEffect(() => {
    if (!secretsHelperPendingPanelRef.current || isBusy) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      const parts = last.parts ?? [];
      const hasText = parts.some(
        (p) => p.type === "text" && typeof (p as { text?: string }).text === "string" && (p as { text: string }).text.trim(),
      );
      if (hasText) {
        secretsHelperPendingPanelRef.current = false;
        setSecretsChatPanelOpen(true);
      }
    }
  }, [isBusy, messages]);

  const drainPromptQueue = React.useCallback(() => {
    if (streamActiveRef.current || buildJobActiveRef.current || submitInFlightRef.current) return;
    const credits = useCreditsStore.getState().build.available;
    if (credits <= 0) {
      setCreditError(true);
      return;
    }
    const nextIdx = promptQueueRef.current.findIndex((q) => q.status === "queued");
    if (nextIdx < 0) return;
    const next = promptQueueRef.current[nextIdx]!;
    promptQueueRef.current.splice(nextIdx, 1);
    syncQueueState();
    setLockedTaskMode(next.mode);
    lockedTaskModeRef.current = next.mode;
    if (next.mode !== mode) setMode(next.mode);
    toast.info("Starting queued prompt…");
    pendingOperationIdRef.current = null;
    void runSubmitRef.current("button", next.text);
  }, []);
  drainPromptQueueRef.current = drainPromptQueue;

  const handleFormSubmit = React.useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDebugSubmitted(true);
    setSubmitStatusLabel("Click detected");
    uiSubmitLog("create-ui", "form submit fired");
    submitDebug("create", "form submit fired");
    void runSubmitRef.current("form");
  }, []);

  const handleFormSubmitCapture = React.useCallback(() => {
    setSubmitStatusLabel("Click detected");
  }, []);

  const cleanAutostartUrl = React.useCallback(() => {
    if (!searchParams?.get("autostart")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("autostart");
    next.delete("prompt");
    const qs = next.toString();
    const target = qs ? `${pathname}?${qs}` : pathname || "/create";
    replaceBrowserUrl(target);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    if (!pendingUserBubble) return;
    const matched = messages.some(
      (m) => m.role === "user" && messageText(m).trim() === pendingUserBubble.trim(),
    );
    if (matched) setPendingUserBubble(null);
  }, [messages, pendingUserBubble]);

  React.useEffect(() => {
    if (!showOptimisticAssistant) return;
    const hasRealAssistant = messages.some(
      (m) =>
        m.role === "assistant" &&
        !String(m.id).startsWith("optimistic-") &&
        messageText(m).trim().length > 12,
    );
    if (hasRealAssistant) setShowOptimisticAssistant(false);
  }, [messages, showOptimisticAssistant]);

  React.useEffect(() => {
    if (!hydrated || !initialAutoStart) return;
    if (autostartConsumedRef.current || autoStartedRef.current) return;

    try {
    const urlPrompt = initialPrompt.trim();
    const peeked = peekPendingAutostartHandoff();
    if (!urlPrompt && !peeked?.text) return;

    const pending = urlPrompt ? seedPendingFromUrl(urlPrompt, mode) : peeked;
    if (pending && wasOperationSubmitted(pending.id)) return;

    const handoff = consumeAutostartHandoff(urlPrompt || peeked!.text, mode);
    if (!handoff) return;

    autostartConsumedRef.current = true;
    autoStartedRef.current = true;
    handoffProjectKeyRef.current = handoff.idempotencyKey;
    buildJobActiveRef.current = false;
    if (effectiveProjectId && uid) {
      convHydratedRef.current = `${effectiveProjectId}:${uid}`;
    }
    if (safeInitialConversationId) {
      setConversationId(safeInitialConversationId);
      conversationIdRef.current = safeInitialConversationId;
    }

    setChatEngaged(true);
    if (!safeInitialConversationId) {
      setPendingUserBubble(handoff.text);
    }
    setMobilePanel("chat");
    applyComposerText("");
    if (handoff.buildStrategy) {
      setBuildStrategy(handoff.buildStrategy);
      buildStrategyRef.current = handoff.buildStrategy;
    }
    if (handoff.modelId) {
      setModelId(handoff.modelId);
    }
    cleanAutostartUrl();

    invokeAutostartSubmit("url-auto", handoff.text);
    } catch (err) {
      autoStartedRef.current = false;
      autostartConsumedRef.current = false;
      pushRuntimeDiagnostic("handoff_failed", {
        reason: "autostart_effect_throw",
        message: err instanceof Error ? err.message : String(err),
      });
      setAutoStartFailed("Could not start automatically. Tap retry below.");
      if (process.env.NODE_ENV !== "production") {
        console.error("[create-workspace] autostart failed", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot autostart
  }, [hydrated, initialAutoStart, initialPrompt, mode, cleanAutostartUrl, invokeAutostartSubmit, safeInitialConversationId]);

  React.useEffect(() => {
    if (!hydrated) return;
    pushSubmitTrace("create", "Create composer mounted", { level: "ok" });
  }, [hydrated]);

  /** Native capture listeners — works even if React handlers fail to attach. */
  React.useEffect(() => {
    if (!hydrated) return;
    const btn = composerRootRef.current?.querySelector(
      "[data-create-build-btn]",
    ) as HTMLButtonElement | null;
    if (!btn) {
      pushSubmitTrace("create", "Build button missing from DOM — cannot wire click", {
        level: "error",
        error: "Build button not found. Try refreshing the page.",
      });
      return;
    }
    pushSubmitTrace("create", "Build button found — native listeners attached", { level: "ok" });

    const onPointerDown = () => {
      setDebugClicked(true);
      setSubmitStatusLabel("Pointer down detected");
      uiSubmitLog("create-ui", "build pointer down");
    };
    const onClick = () => {
      setDebugClicked(true);
      setSubmitStatusLabel("Click detected");
      uiSubmitLog("create-ui", "build click (native)");
      void runSubmitRef.current("button");
    };

    btn.addEventListener("pointerdown", onPointerDown, true);
    btn.addEventListener("click", onClick, true);
    return () => {
      btn.removeEventListener("pointerdown", onPointerDown, true);
      btn.removeEventListener("click", onClick, true);
    };
  }, [hydrated, mode]);

  const showEmpty = !chatEngaged && messages.length === 0 && !pendingUserBubble && !isBusy;
  const lastAssistantTextEarly = React.useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    return last ? messageText(last) : "";
  }, [messages]);
  const parsedSourceFilesEarly = React.useMemo(
    () => parseFencedFiles(lastAssistantTextEarly),
    [lastAssistantTextEarly],
  );
  const zipImportMeta = React.useMemo(() => {
    const meta = effectiveProject?.metadata;
    if (!isZipImportProject(meta)) return null;
    return readImportMeta(meta);
  }, [effectiveProject?.metadata]);
  const hasGeneratedFiles = isProjectFilesReady({
    metadata: effectiveProject?.metadata,
    fileCount: zipImportMeta?.file_count,
    build_status: effectiveProject?.build_status,
    loadedPathCount: projectFiles.length,
  }) || projectFiles.length > 0 || parsedSourceFilesEarly.length > 0;
  const pipelineBusyForQueue =
    streamActiveRef.current ||
    submitInFlightRef.current ||
    (activeBuildJob != null && (buildJobProgress == null || !buildJobProgress.done));
  /** Follow-up prompts on a built project queue instead of starting a new build (P0.22). */
  pipelineBusyForQueueRef.current = pipelineBusyForQueue;
  const queueReady = buildJobActive;
  const composerReadyToSend = composerHasText || composerDomHasText;
  const showQueueAffordance = buildJobActive && composerReadyToSend;
  const filesReady = hasGeneratedFiles;
  const importedReady = isImportedProjectReady({
    metadata: effectiveProject?.metadata,
    build_status: effectiveProject?.build_status,
    fileCount: zipImportMeta?.file_count,
    loadedPathCount: projectFiles.length,
  });
  const isImportedZipProject = zipImportMeta !== null;

  async function prepareImportedApp() {
    if (!effectiveProjectId || prepareImportBusy) return;
    setPrepareImportBusy(true);
    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/prepare-import`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not prepare imported app");
      invalidateProjectFilesCache(effectiveProjectId);
      setProjectDataRefresh((n) => n + 1);
      toast.success("Imported app prepared — preview and code are ready to review.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setPrepareImportBusy(false);
    }
  }

  const importAutoPrepareRef = React.useRef(false);
  React.useEffect(() => {
    importAutoPrepareRef.current = false;
  }, [effectiveProjectId]);

  React.useEffect(() => {
    if (!importedReady || !effectiveProjectId || prepareImportBusy || importAutoPrepareRef.current) return;
    const impObj = (effectiveProject?.metadata as Record<string, unknown> | undefined)?.import;
    const preparedAt =
      impObj && typeof impObj === "object" && !Array.isArray(impObj)
        ? (impObj as Record<string, unknown>).prepared_at
        : null;
    const fileHint = projectFiles.length > 0 || (zipImportMeta?.file_count ?? 0) > 0;
    if (fileHint && !preparedAt) {
      importAutoPrepareRef.current = true;
      void prepareImportedApp();
    }
  }, [
    importedReady,
    effectiveProjectId,
    effectiveProject?.metadata,
    projectFiles.length,
    zipImportMeta?.file_count,
    prepareImportBusy,
  ]);
  const isZipImportApp = zipImportMeta != null;
  const isFirstCreatePrompt = showEmpty && !hasGeneratedFiles && !isZipImportApp;
  const disabledModes = React.useMemo((): CreationMode[] => {
    if (isFirstCreatePrompt) return ["discuss", "edit"];
    if (!hasGeneratedFiles) return ["edit"];
    return [];
  }, [isFirstCreatePrompt, hasGeneratedFiles]);

  React.useEffect(() => {
    if (disabledModes.includes(mode)) setMode("build");
  }, [disabledModes, mode]);
  const modeStyle = MODE_STYLE[mode];
  const lastAssistantText = lastAssistantTextEarly;
  const parsedSourceFiles = parsedSourceFilesEarly;

  /** Resume build from session handoff when user lands on builder before create-page enqueue finished. */
  React.useEffect(() => {
    if (!hydrated || !effectiveProjectId || initialAutoStart) return;
    if (buildJobActiveRef.current || activeBuildJob) return;
    if (autostartConsumedRef.current || autoStartedRef.current || submitInFlightRef.current) return;
    if (projectFiles.length > 0 || parsedSourceFiles.length > 0) return;
    const handoff = consumeAutostartHandoff("", mode);
    if (!handoff?.text?.trim()) return;

    autostartConsumedRef.current = true;
    autoStartedRef.current = true;
    handoffProjectKeyRef.current = handoff.idempotencyKey;
    setChatEngaged(true);
    setPendingUserBubble(handoff.text);
    invokeAutostartSubmit("url-auto", handoff.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once per project mount
  }, [hydrated, effectiveProjectId, activeBuildJob, projectFiles.length, parsedSourceFiles.length, initialAutoStart, mode]);

  const codeFiles = React.useMemo((): CodeExplorerFile[] => {
    if (projectFiles.length > 0) return projectFiles;
    return parsedSourceFiles;
  }, [projectFiles, parsedSourceFiles]);
  const [previewRuntime, setPreviewRuntime] = React.useState<PreviewRuntimeStatusPayload | null>(
    null,
  );
  const [previewRoutes, setPreviewRoutes] = React.useState<PreviewRouteEntry[]>([
    { path: "/", label: "Home", source: "default" },
  ]);
  const [previewRoute, setPreviewRoute] = React.useState("/");
  const [previewRebuilding, setPreviewRebuilding] = React.useState(false);
  const [previewStateRepairing, setPreviewStateRepairing] = React.useState(false);

  React.useEffect(() => {
    if (codeFiles.length === 0) return;
    const next = detectPreviewRoutesFromFiles(
      codeFiles.map((f) => ({ path: f.path, content: f.content })),
    );
    setPreviewRoutes((prev) => {
      if (
        prev.length === next.length &&
        prev.every((r, i) => r.path === next[i]?.path && r.label === next[i]?.label)
      ) {
        return prev;
      }
      return next;
    });
  }, [codeFiles]);

  const [previewStarting, setPreviewStarting] = React.useState(false);

  const startPreviewSession = React.useCallback(async () => {
    if (!effectiveProjectId) return;
    setPreviewStarting(true);
    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/preview/start`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; previewUrl?: string };
      if (body.ok) {
        toast.success("Preview session started");
      } else {
        toast.error(body.error ?? "Could not start preview");
      }
      setProjectDataRefresh((n) => n + 1);
    } catch {
      toast.error("Could not start preview");
    } finally {
      setPreviewStarting(false);
    }
  }, [effectiveProjectId]);

  const rebuildPreview = React.useCallback(async () => {
    if (!effectiveProjectId) return;
    setPreviewRebuilding(true);
    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/preview/build`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        queued?: boolean;
        message?: string;
        blockedReason?: string;
      };
      if (body.queued) {
        toast.info(body.message ?? "Preview build queued for worker");
      } else if (body.ok) {
        toast.success("Preview is ready");
      } else {
        toast.error(body.blockedReason ?? body.message ?? "Preview build failed");
      }
      setProjectDataRefresh((n) => n + 1);
    } catch {
      toast.error("Could not rebuild preview");
    } finally {
      setPreviewRebuilding(false);
    }
  }, [effectiveProjectId]);

  const [innerRouteRepairing, setInnerRouteRepairing] = React.useState(false);

  const runInnerRouteRepair = React.useCallback(async () => {
    if (!effectiveProjectId) return;
    setInnerRouteRepairing(true);
    try {
      const res = await fetch(
        `/api/projects/${effectiveProjectId}/preview/inner-route-repair`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json()) as {
        ok?: boolean;
        queued?: boolean;
        message?: string;
        error?: string;
      };
      if (body.ok) {
        toast.success(body.message ?? "Inner route repair started");
      } else {
        toast.error(body.error ?? "Inner route repair failed");
      }
      setProjectDataRefresh((n) => n + 1);
    } catch {
      toast.error("Could not run inner route repair");
    } finally {
      setInnerRouteRepairing(false);
    }
  }, [effectiveProjectId]);

  const previewArtifactLockedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    previewArtifactLockedRef.current = null;
  }, [effectiveProjectId]);

  const shouldPollPreview = shouldPollPreviewRuntime({
    projectId: effectiveProjectId,
    projectFilesCount: projectFiles.length,
    projectMetadata: effectiveProject?.metadata,
    projectPreviewUrl: effectiveProject?.preview_url ?? null,
    previewArtifactId:
      previewArtifactLockedRef.current ??
      (typeof effectiveProject?.metadata === "object" &&
      effectiveProject.metadata &&
      !Array.isArray(effectiveProject.metadata)
        ? (effectiveProject.metadata as Record<string, unknown>).preview_job_id
        : null) as string | null,
  });

  React.useEffect(() => {
    if (!shouldPollPreview) {
      setPreviewRuntime(null);
      return;
    }
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`/api/projects/${effectiveProjectId}/preview/import-status`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok || cancelled) return;
        const body = (await r.json()) as PreviewRuntimeStatusPayload;
        setPreviewRuntime((prev) => (previewRuntimeStatusEqual(prev, body) ? prev : body));
      } catch {
        /* ignore */
      }
    };

    void poll();
    const t = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [effectiveProjectId, shouldPollPreview, projectDataRefresh]);

  React.useEffect(() => {
    if (previewRuntime?.previewRenderable && previewRuntime.jobId) {
      if (!previewArtifactLockedRef.current) {
        previewArtifactLockedRef.current = previewRuntime.jobId;
      }
    }
  }, [previewRuntime?.previewRenderable, previewRuntime?.jobId]);
  const previewArtifactId =
    previewArtifactLockedRef.current ?? previewRuntime?.jobId ?? null;
  const previewCacheBust = previewArtifactLockedRef.current ? undefined : projectDataRefresh;

  const previewUrlResolution = React.useMemo(() => {
    if (!effectiveProjectId) return null;
    const generatedFallback = projectPreviewFrameUrl(
      effectiveProjectId,
      previewCacheBust,
      "/",
      previewArtifactId,
    );
    const routeSwitcherUrl = projectPreviewFrameUrl(
      effectiveProjectId,
      previewCacheBust,
      "/",
      previewArtifactId,
    );
    return resolvePreviewIframeUrl({
      projectId: effectiveProjectId,
      route: previewRoute,
      cacheBust: previewCacheBust ?? null,
      artifactId: previewArtifactId,
      candidates: [
        { source: "previewRuntime.previewUrl", url: previewRuntime?.previewUrl },
        { source: "runtime.previewUrl", url: previewRuntime?.previewUrl },
        { source: "project.preview_url", url: effectiveProject?.preview_url },
        { source: "route_switcher", url: routeSwitcherUrl },
        { source: "generated_fallback", url: generatedFallback },
      ],
    });
  }, [
    effectiveProjectId,
    previewCacheBust,
    previewArtifactId,
    previewRuntime?.previewUrl,
    previewRuntime?.jobId,
    effectiveProject?.preview_url,
    projectDataRefresh,
  ]);

  /** Stable mount URL only — route navigation uses postMessage, not URL churn. */
  const previewFrameUrl = previewUrlResolution?.iframeSrc ?? previewUrlResolution?.normalizedPreviewUrl ?? null;

  const refreshPreviewRuntime = React.useCallback(() => {
    if (!effectiveProjectId) return;
    void fetch(`/api/projects/${effectiveProjectId}/preview/import-status`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body) setPreviewRuntime(body as PreviewRuntimeStatusPayload);
      })
      .catch(() => undefined);
  }, [effectiveProjectId]);

  const handleClearPreviewCache = React.useCallback(() => {
    if (!effectiveProjectId) return;
    clearPreviewClientCache(effectiveProjectId);
    previewArtifactLockedRef.current = null;
    setProjectDataRefresh((n) => n + 1);
    refreshPreviewRuntime();
  }, [effectiveProjectId, refreshPreviewRuntime]);

  const handleRepairPreviewState = React.useCallback(async () => {
    if (!effectiveProjectId || previewStateRepairing) return;
    setPreviewStateRepairing(true);
    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/preview/state-repair`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        repaired?: boolean;
        runtime?: PreviewRuntimeStatusPayload;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Preview state repair failed");
      if (body.runtime) setPreviewRuntime(body.runtime);
      clearPreviewClientCache(effectiveProjectId);
      previewArtifactLockedRef.current = null;
      setProjectDataRefresh((n) => n + 1);
      refreshPreviewRuntime();
      toast.success(body.repaired ? "Preview state repaired" : "Preview state refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview state repair failed");
    } finally {
      setPreviewStateRepairing(false);
    }
  }, [effectiveProjectId, previewStateRepairing, refreshPreviewRuntime]);

  const previewSrcRenderable = previewRuntime?.previewRenderable === true;

  const hardImportedPreviewReady = React.useMemo(
    () =>
      isHardImportedPreviewReady({
        projectMetadata: effectiveProject?.metadata,
        runtimeStatus: previewRuntime,
        urlResolution: previewUrlResolution,
        iframeUrl: previewFrameUrl,
        projectPreviewUrl: effectiveProject?.preview_url ?? null,
      }),
    [
      effectiveProject?.metadata,
      effectiveProject?.preview_url,
      previewRuntime,
      previewUrlResolution,
      previewFrameUrl,
    ],
  );

  const previewReadyForUi = previewSrcRenderable || hardImportedPreviewReady;

  const appBuildTruth = React.useMemo(() => {
    const meta =
      effectiveProject?.metadata &&
      typeof effectiveProject.metadata === "object" &&
      !Array.isArray(effectiveProject.metadata)
        ? (effectiveProject.metadata as Record<string, unknown>)
        : {};
    const latestMeta = (buildJobProgress?.latest?.metadata ?? {}) as Record<string, unknown>;
    return resolveAppBuildTruthFromFacts({
      dbAppFilesCount: projectFiles.length,
      workflowEvents: buildJobProgress?.events,
      previewSessionId:
        typeof meta.preview_session_id === "string" ? meta.preview_session_id : null,
      previewBuildJobId:
        previewRuntime?.jobId ??
        (typeof meta.preview_job_id === "string" ? meta.preview_job_id : null),
      previewArtifactExists:
        Boolean(previewRuntime?.jobId) ||
        meta.preview_renderable === true ||
        meta.preview_ready === true ||
        typeof meta.preview_artifact_path === "string",
      previewRenderable: previewReadyForUi,
      sourceIntegrityOk: meta.source_integrity_ok !== false,
      previewStatus:
        typeof meta.preview_status === "string"
          ? meta.preview_status
          : typeof latestMeta.preview_status === "string"
            ? latestMeta.preview_status
            : null,
      continuingGenerationNeeded:
        meta.continuing_generation_needed === true ||
        latestMeta.continuing_generation_needed === true,
      failedDraft: meta.failed_draft === true || latestMeta.failed_draft === true,
      failureKind:
        typeof latestMeta.failure_kind === "string"
          ? latestMeta.failure_kind
          : typeof meta.failure_kind === "string"
            ? meta.failure_kind
            : null,
      isImportedApp: isImportedZipProject,
      buildActive: buildJobActive || buildStarting,
    });
  }, [
    effectiveProject?.metadata,
    projectFiles.length,
    buildJobProgress?.events,
    buildJobProgress?.latest?.metadata,
    previewRuntime?.jobId,
    previewReadyForUi,
    isImportedZipProject,
    buildJobActive,
    buildStarting,
  ]);

  const previewAutoStartRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    previewAutoStartRef.current = null;
  }, [effectiveProjectId]);

  React.useEffect(() => {
    if (!previewSrcRenderable || projectFiles.length < 4) return;
    setBuildRunSummary((prev) => {
      if (!prev) return prev;
      if (prev.variant === "completed" && prev.status === "completed") return prev;
      return {
        variant: "completed",
        status: "completed",
        headline: "Done — preview is ready",
        bodyLines: [
          `${projectFiles.length} file${projectFiles.length === 1 ? "" : "s"} in your project`,
          "Preview is live — open the Preview tab to explore your app.",
        ],
        showRefundLine: false,
        showRepairActions: false,
        showPreviewActions: true,
        refunded: false,
      };
    });
    setSubmitStatusLabel("Done");
  }, [previewSrcRenderable, projectFiles.length]);

  const persistenceConfirmed = React.useMemo(() => {
    if (projectFiles.length < 4) return false;
    const meta =
      project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
        ? (project.metadata as Record<string, unknown>)
        : {};
    return (
      meta.files_persist_confirmed === true ||
      meta.source_integrity_ok === true ||
      projectFiles.length >= 4
    );
  }, [project?.metadata, projectFiles.length]);

  React.useEffect(() => {
    if (!effectiveProjectId || !persistenceConfirmed) return;
    if (appBuildTruth.isBlocked || appBuildTruth.isIncompleteNewBuild) return;
    if (buildJobActive || buildStarting || previewStarting) return;
    if (previewSrcRenderable) return;
    if (!previewRuntime) return;
    if (previewAutoStartRef.current === effectiveProjectId) return;

    const jobMissing =
      previewRuntime.previewFailureKind === "no_preview_job" ||
      previewRuntime.previewStatus === "not_started";
    const jobStuck =
      Boolean(previewRuntime.jobId) &&
      !previewRuntime.previewRenderable &&
      previewRuntime.jobStatus !== "running";
    if (!jobMissing && !jobStuck) return;

    previewAutoStartRef.current = effectiveProjectId;
    void startPreviewSession();
  }, [
    effectiveProjectId,
    persistenceConfirmed,
    buildJobActive,
    buildStarting,
    previewStarting,
    previewSrcRenderable,
    previewRuntime,
    startPreviewSession,
    appBuildTruth.isBlocked,
    appBuildTruth.isIncompleteNewBuild,
  ]);

  const importedPreviewClassification = React.useMemo(
    () =>
      classifyImportedPreviewState(previewRuntime, {
        isImported: isImportedZipProject,
        hasFiles: codeFiles.length > 0 || projectFiles.length > 0,
      }),
    [previewRuntime, isImportedZipProject, codeFiles.length, projectFiles.length],
  );
  const activeMode = lockedTaskMode ?? mode;
  const buildActive =
    activeMode === "build" &&
    (buildJobActive || buildStarting || (isBusy && !previewSrcRenderable));

  const [previewIssue, setPreviewIssue] = React.useState<PreviewBlockingIssue | null>(null);
  const [previewDismissed, setPreviewDismissed] = React.useState(false);

  const repairChatPrompt = React.useMemo(() => {
    if (!previewIssue) return "";
    return buildRepairChatPrompt({
      issue: previewIssue,
      files: codeFiles.map((f) => ({ path: f.path, content: f.content })),
      projectName: effectiveProject?.name ?? undefined,
    });
  }, [previewIssue, codeFiles, effectiveProject?.name]);

  function sendPreviewRepairToChat(autoSend: boolean) {
    if (!repairChatPrompt) return;
    setMode("edit");
    setMobilePanel("chat");
    applyComposerText(repairChatPrompt);
    setPreviewDismissed(true);
    formRef.current?.querySelector("textarea")?.focus();
    if (autoSend) {
      void runSubmitRef.current("button", repairChatPrompt);
    } else {
      toast.info("Repair prompt ready in chat — send when ready");
    }
  }

  React.useEffect(() => {
    setPreviewDismissed(false);
  }, [effectiveProjectId, codeFiles.length]);

  React.useEffect(() => {
    if (!effectiveProjectId || codeFiles.length === 0) {
      setPreviewIssue(null);
      return;
    }
    if (previewSrcRenderable) {
      setPreviewIssue(null);
      return;
    }
    if (
      isImportedZipProject &&
      (importedPreviewClassification.state === "preview_not_started" ||
        importedPreviewClassification.state === "preview_loading" ||
        importedPreviewClassification.state === "preview_artifact_missing")
    ) {
      setPreviewIssue(null);
      return;
    }
    if (previewRuntime && !previewRuntime.previewRenderable) {
      const blocker = resolveAuthoritativePreviewBlocker({
        workerConnected: previewRuntime.workerConnected,
        workerUnavailable: previewRuntime.workerUnavailable,
        jobStatus: previewRuntime.jobStatus,
        previewStatus: previewRuntime.previewStatus,
        previewRenderable: previewRuntime.previewRenderable,
        blockedReason: previewRuntime.blockedReason,
        errorCode: previewRuntime.errorCode,
        userMessage: previewRuntime.userMessage,
        requiresDeployedWorker: previewRuntime.requiresDeployedWorker,
      });
      if (blocker) {
        setPreviewIssue({
          title: blocker.title,
          summary: blocker.summary,
          details: blocker.details,
          fixHint: blocker.fixHint,
        });
        return;
      }
    }
    let cancelled = false;
    fetch(`/api/projects/${effectiveProjectId}/repair`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { issues?: Array<{ title: string; summary: string; whatHappened?: string; exactFix?: string }> } | null) => {
        if (cancelled) return;
        const first = data?.issues?.[0];
        if (first) {
          setPreviewIssue({
            title: first.title,
            summary: first.summary,
            details: first.whatHappened,
            fixHint: first.exactFix,
          });
        } else {
          setPreviewIssue(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewIssue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    effectiveProjectId,
    codeFiles.length,
    projectDataRefresh,
    previewSrcRenderable,
    previewRuntime,
    isImportedZipProject,
    importedPreviewClassification.state,
  ]);
  const extractedCode = React.useMemo(() => extractFencedCode(lastAssistantText), [lastAssistantText]);
  const integrationSecretKeys = React.useMemo(
    () => (mode === "build" ? detectRequiredSecretNames(lastAssistantText) : []),
    [mode, lastAssistantText],
  );
  const buildPlanForStep = React.useMemo(
    () => (mode === "build" && lastAssistantText ? parseBuildPlanCard(lastAssistantText) : null),
    [mode, lastAssistantText],
  );
  const buildStepIndex = buildPlanForStep
    ? taskProgressIndex(lastAssistantText.length, buildPlanForStep.taskLabels.length)
    : 0;
  const buildStepLabel = buildPlanForStep?.taskLabels[buildStepIndex] ?? null;
  const previewShellState: "idle" | "building" | "compiling" = previewSrcRenderable
    ? "idle"
    : buildActive
      ? "building"
      : codeFiles.length > 0 && isBusy
        ? "compiling"
        : buildActive
          ? "building"
          : "idle";
  const modelLabel =
    preflightEstimate?.provider && preflightEstimate?.modelId
      ? `${preflightEstimate.provider} · ${preflightEstimate.modelId}`
      : null;
  const plan = profile?.plan_id ?? "free";
  const showFreeWatermark = plan === "free";
  const generationActive = messages.length > 0 || isBusy;

  const tabBtn = (id: WorkspaceRightTab, label: string, Icon: typeof MonitorPlay, disabled?: boolean) => (
    <button
      key={id}
      type="button"
      disabled={disabled}
      onClick={() => setRightTab(id)}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition",
        disabled && "cursor-not-allowed opacity-40",
        !disabled && rightTab === id
          ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
          : !disabled && "text-muted-foreground hover:bg-surface/80 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );

  return (
    <DropZone
      onFiles={onFiles}
      disabled={composerBlocked}
      className="flex h-screen w-full flex-col overflow-hidden"
      data-testid="builder-shell"
    >
      {mode === "build" ? (
        <span data-testid="build-mode-active" className="sr-only" aria-hidden>
          build
        </span>
      ) : null}
      {debugEnabled && (
        <motion.div
          className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-950 dark:text-amber-100"
          data-testid="create-build-bundle"
        >
          Create build bundle: {CREATE_BUILD_BUNDLE}
        </motion.div>
      )}
      <WorkspaceLauncher
        project={
          effectiveProject
            ? {
                id: effectiveProject.id,
                name: resolveProjectDisplayName({
                  app_name: (effectiveProject as { app_name?: string | null }).app_name,
                  name: effectiveProject.name,
                }),
                icon_url: effectiveProject.icon_url,
                gradient: effectiveProject.gradient,
                preview_url: effectiveProject.preview_url,
                metadata: effectiveProject.metadata,
                status: effectiveProject.status,
              }
            : null
        }
        generationActive={generationActive}
        isBusy={isBusy}
        planId={profile?.plan_id}
        onRightTab={setRightTab}
        onAppSection={(section) => {
          const map: Record<string, DashSection> = {
            overview: "overview",
            dashboard: "overview",
            deploy: "publish",
            publish: "publish",
            settings: "settings",
            domains: "domains",
            integrations: "integrations",
            secrets: "secrets",
            users: "users",
            data: "data",
            analytics: "analytics",
            security: "security",
            auth: "auth",
            authentication: "auth",
            code: "code",
            template: "template",
            payments: "payments",
          };
          setDashboardSection(map[section] ?? "overview");
          setRightTab("dashboard");
          setMobilePanel("dashboard");
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-background/90 px-2 py-1.5 lg:hidden safe-area-pad-x">
          {(
            [
              ["chat", "Chat", MessageSquare],
              ["preview", "Preview", MonitorPlay],
              ["dashboard", "Dashboard", LayoutGrid],
              ["code", "Code", Code2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              disabled={id === "dashboard" && !effectiveProject?.id}
              onClick={() => {
                setMobilePanel(id);
                if (id !== "chat") setRightTab(id);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold",
                mobilePanel === id
                  ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-border/50 max-lg:flex-1 max-lg:w-full max-lg:max-w-none",
            "lg:w-[34%] lg:min-w-[280px] lg:max-w-[420px] lg:border-r",
            mobilePanel !== "chat" && "max-lg:hidden",
          )}
        >
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/50 bg-background/60 px-2.5 backdrop-blur-sm">
            <ModeSwitch
              value={activeMode}
              onChange={(m) => {
                if (lockedTaskMode || buildJobActive || buildStarting || submitInFlightRef.current) return;
                setMode(m);
              }}
              disabledModes={
                lockedTaskMode || buildJobActive || buildStarting
                  ? (["discuss", "edit", "build"] as const)
                  : disabledModes
              }
            />
            {modeStyle.badge && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", modeStyle.badge.color)}>
                {modeStyle.badge.label}
              </span>
            )}
            {effectiveProjectId ? (
              <VersionHistoryEntryButton
                className="ml-auto"
                onClick={() => setVersionDrawerOpen(true)}
              />
            ) : null}
          </div>

          <div
            ref={scrollRef}
            onScroll={onChatScroll}
            className={cn(
              "scrollbar-workflow vodex-scroll-panel min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]",
              mode === "build" && "bg-gradient-to-b from-accent/[0.04] to-transparent",
            )}
          >
            <div className="space-y-3 px-3 py-4">
              {showEmpty && (
                <div className="flex flex-col items-center pt-4 text-center sm:pt-6">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent/30 to-accent/10">
                    <Zap className="size-4 text-accent" strokeWidth={1.75} />
                  </div>
                  {isZipImportApp ? (
                    <>
                      <p className="mt-2 text-[13px] font-semibold text-foreground">Imported app ready</p>
                      <p className="mt-0.5 max-w-[260px] text-[11.5px] text-muted-foreground">
                        Imported app · {zipImportMeta?.file_count ?? projectFiles.length} files ready
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRightTab("code")}
                          className="rounded-lg bg-accent/12 px-2.5 py-1.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20"
                        >
                          Review files
                        </button>
                        <button
                          type="button"
                          onClick={() => setRightTab("preview")}
                          className="rounded-lg bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground ring-1 ring-border"
                        >
                          Open preview
                        </button>
                        <button
                          type="button"
                          data-testid="prepare-imported-app"
                          disabled={prepareImportBusy}
                          onClick={() => void prepareImportedApp()}
                          className="rounded-lg bg-emerald-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-100"
                        >
                          {prepareImportBusy ? "Preparing…" : "Prepare imported app"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-[13px] font-semibold text-foreground">
                        {mode === "build" ? "Start your build" : "How can we help?"}
                      </p>
                      <p className="mt-0.5 max-w-[240px] text-[11.5px] text-muted-foreground">{MODE_META[mode].description}</p>
                    </>
                  )}
                </div>
              )}

              {pendingUserBubble &&
                !messages.some(
                  (m) => m.role === "user" && messageText(m).trim() === pendingUserBubble.trim(),
                ) && (
                  <MessageBubble
                    message={
                      {
                        id: `pending-user-${pendingOperationIdRef.current ?? "local"}`,
                        role: "user",
                        parts: [{ type: "text", text: pendingUserBubble }],
                      } satisfies UIMessage
                    }
                    userAvatar={profile?.avatar_url ?? null}
                    userName={resolveDisplayName(profile, user)}
                    mode={mode}
                  />
                )}

              {autoStartFailed && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
                  <p>{autoStartFailed}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const retryText = pendingUserBubble ?? initialPrompt.trim() ?? input.trim();
                      setAutoStartFailed(null);
                      autostartConsumedRef.current = false;
                      autoStartedRef.current = false;
                      pendingOperationIdRef.current = null;
                      if (retryText) {
                        setChatEngaged(true);
                        setPendingUserBubble(retryText);
                        void runSubmitRef.current("button", retryText);
                      }
                    }}
                    className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              )}

              <AnimatePresence initial={false}>
                {visibleMessages.map((m, i) => {
                  const isLastAssistant =
                    m.role === "assistant" &&
                    i === visibleMessages.length - 1 &&
                    !isBusy;
                  const storedCost = assistantMessageCosts[m.id];
                  const costInfo =
                    m.role === "assistant"
                      ? storedCost ??
                        (isLastAssistant ? lastMessageCost ?? undefined : undefined)
                      : undefined;
                  const showPlanInChat =
                    m.role === "assistant" &&
                    isLastAssistant &&
                    !effectiveProjectId &&
                    buildStrategy === "plan_first" &&
                    !blueprintApproved &&
                    Boolean(blueprint);
                  return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    userAvatar={profile?.avatar_url ?? null}
                    userName={resolveDisplayName(profile, user)}
                    streaming={isBusy && i === messages.length - 1 && m.role === "assistant"}
                    mode={mode}
                    creditsUsed={costInfo?.credits}
                    costState={costInfo?.state}
                    planFooter={
                      showPlanInChat ? (
                        <div className="mt-2">
                          <AppPlanInlineCard
                            blueprint={blueprint}
                            loading={blueprintLoading}
                            onBuildThisApp={() => void confirmBlueprintBuild()}
                          />
                        </div>
                      ) : undefined
                    }
                  />
                  );
                })}
              </AnimatePresence>

              {secretsChatPanelOpen && effectiveProjectId && zipImportMeta ? (
                <SecretSetupPanel
                  projectId={effectiveProjectId}
                  envRequirements={zipImportMeta.env_requirements}
                  onClose={() => setSecretsChatPanelOpen(false)}
                  onSkipOptional={() => setSecretsChatPanelOpen(false)}
                  onSaved={() => setProjectDataRefresh((n) => n + 1)}
                />
              ) : null}

              {showOptimisticAssistant &&
                !(activeMode === "build" && (buildJobActive || buildStarting || buildJobProgress || frozenBuildWorkflow)) &&
                (pendingUserBubble ||
                  isBusy ||
                  ((buildStarting || buildJobActive) && activeMode === "build")) && (
                <OptimisticAssistantRow
                  mode={
                    (lockedTaskMode ?? mode) === "discuss"
                      ? "discuss"
                      : (lockedTaskMode ?? mode) === "edit"
                        ? "edit"
                        : "build"
                  }
                />
              )}

              {isBusy &&
                !showOptimisticAssistant &&
                (messages[messages.length - 1]?.role === "user" || pendingUserBubble) &&
                !(activeMode === "build" && (buildJobActive || buildStarting)) && (
                <MessageBubble
                  message={{ id: "pending", role: "assistant", parts: [{ type: "text", text: "" }] } satisfies UIMessage}
                  userName="Vodex"
                  streaming
                  mode={mode}
                />
              )}

              {activeMode === "build" &&
                (buildJobActive || buildStarting || frozenBuildWorkflow) && (
                <BuildLiveProgress
                  progress={
                    buildJobActive || buildStarting
                      ? buildJobProgress
                      : frozenBuildWorkflow
                  }
                  className="mt-1"
                  buildStartedAtMs={buildStartedAtRef.current ?? undefined}
                  userPrompt={activeBuildPromptRef.current}
                  projectId={effectiveProjectId ?? undefined}
                  ownerDiagnostics={{
                    open: ownerDiagOpen,
                    onOpen: () => setOwnerDiagOpen(true),
                  }}
                  previewSucceeded={previewSrcRenderable}
                  savedFileCount={projectFiles.length}
                />
              )}
              {buildRunSummary && !buildJobActive && !previewSrcRenderable && (
                <BuildRunSummaryCard
                  variant={buildRunSummary.variant}
                  status={buildRunSummary.status}
                  headline={buildRunSummary.headline ?? appBuildTruth.headline}
                  bodyLines={buildRunSummary.bodyLines ?? [appBuildTruth.bodyLine].filter(Boolean)}
                  appName={project?.name ?? undefined}
                  filesCount={projectFiles.length}
                  previewReady={previewSrcRenderable}
                  creditsUsed={buildRunSummary.creditsUsed}
                  remainingSummary={buildRunSummary.remainingSummary}
                  errorMessage={buildRunSummary.errorMessage}
                  failureCode={buildRunSummary.failureCode}
                  refunded={buildRunSummary.refunded}
                  showRefundLine={buildRunSummary.showRefundLine}
                  showRepairActions={buildRunSummary.showRepairActions && appBuildTruth.showRepair}
                  showPreviewActions={buildRunSummary.showPreviewActions && appBuildTruth.canPreview}
                  showContinueGeneration={
                    buildRunSummary.showContinueGeneration ?? appBuildTruth.showContinueGeneration
                  }
                  onContinue={
                    buildRunSummary.showContinueGeneration ||
                    buildRunSummary.variant === "partial" ||
                    appBuildTruth.showContinueGeneration
                      ? () => {
                          void (async () => {
                            const asyncProjectId = projectIdRef.current ?? effectiveProjectId;
                            if (!asyncProjectId) return;
                            const text = appBuildTruth.continueGenerationPrompt;
                            const opId = crypto.randomUUID();
                            setBuildRunSummary(null);
                            setBuildStarting(true);
                            buildStartedAtRef.current = Date.now();
                            try {
                              const enqueued = await enqueueAsyncBuild({
                                messages: [
                                  ...messages,
                                  {
                                    id: `pending-user-${opId}`,
                                    role: "user" as const,
                                    parts: [{ type: "text" as const, text }],
                                  },
                                ],
                                body: {
                                  modelId,
                                  mode: "build",
                                  mode_at_submit: "build",
                                  strategy: "build_now",
                                  forceBuildPipeline: true,
                                  resumeContinuation: true,
                                  planFirstOnly: false,
                                  projectId: asyncProjectId,
                                  conversationId: conversationIdRef.current ?? undefined,
                                  operationId: opId,
                                  idempotencyKey: opId,
                                },
                              });
                              if (enqueued.conversationId) {
                                conversationIdRef.current = enqueued.conversationId;
                                setConversationId(enqueued.conversationId);
                              }
                              buildJobActiveRef.current = true;
                              setActiveBuildJob({
                                jobId: enqueued.buildJobId!,
                                eventsUrl: enqueued.eventsUrl!,
                                operationId: enqueued.operationId ?? opId,
                              });
                              persistWorkspaceTask({
                                projectId: asyncProjectId,
                                buildJobId: enqueued.buildJobId!,
                                eventsUrl: enqueued.eventsUrl!,
                                operationId: enqueued.operationId ?? opId,
                                lockedMode: "build",
                                buildStartedAtMs: buildStartedAtRef.current ?? Date.now(),
                              });
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Could not resume generation",
                              );
                            } finally {
                              setBuildStarting(false);
                            }
                          })();
                        }
                      : undefined
                  }
                  onRepair={
                    buildRunSummary.showRepairActions && appBuildTruth.showRepair
                      ? () => {
                          setRightTab("preview");
                          setMobilePanel("chat");
                          applyComposerText(
                            "Fix the preview so it renders. Repair any missing routes or imports.",
                          );
                          composerTextareaRef.current?.focus();
                        }
                      : undefined
                  }
                  className="w-full px-1"
                />
              )}
              {(creditError || showUpgradeCard) && (
                <BuildCreditsUpgradePanel
                  className="w-full px-1"
                  planId={planId}
                  resetAt={resetAt}
                  onDismiss={() => setCreditError(false)}
                  compact
                />
              )}
              {error && !creditError && (
                <p className="px-1 text-[13px] leading-relaxed text-destructive">
                  <span className="font-medium">Generation failed:</span>{" "}
                  {sanitizeUserFacingAiError(error.message ?? "Try again.")}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      regenerate();
                    }}
                    className="font-medium underline underline-offset-2"
                  >
                    Retry
                  </button>
                </p>
              )}
            </div>
          </div>

          <div
            ref={composerRootRef}
            className={cn(
              "relative z-30 shrink-0 border-t border-border/50 bg-background/85 px-2.5 pb-3 pt-2 backdrop-blur-md max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              mobilePanel !== "chat" && "max-lg:hidden",
            )}
          >
            {(buildStarting || isStreaming) && (
              <p className="mb-1.5 px-1 text-[10px] text-muted-foreground" data-testid="composer-status-hint">
                {buildStrategy === "plan_first" && !blueprintApproved
                  ? "Planning…"
                  : isStreaming
                    ? "Building…"
                    : "Preparing…"}
              </p>
            )}
            <AttachmentRail attachments={attachments} onRemove={removeAttachment} className="mb-1.5" />
            {emptyInputHint ? (
              <p className="mb-1 px-1 text-[10px] text-muted-foreground">Type a message first.</p>
            ) : null}
            {editTarget && mode === "edit" && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
                <span>
                  Targeting: <strong>{editTarget}</strong>
                </span>
                <button
                  type="button"
                  className="font-semibold hover:underline"
                  onClick={() => {
                    setEditTarget(null);
                    setScope(null);
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            {editNeedsApp && mode === "edit" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100"
              >
                Edit mode needs an app. Switch to Build to create one, or open an existing project.
              </motion.div>
            )}
            {mode === "build" && !blueprintApproved && (
              <div className="mb-2 flex flex-wrap items-center gap-2 px-0.5">
                <PlanFirstToggle
                  enabled={toggleFromBuildStrategy(buildStrategy)}
                  onChange={(on) => setBuildStrategy(buildStrategyFromToggle(on))}
                />
                {suggestBuildStrategy(input) === "plan_first" &&
                !toggleFromBuildStrategy(buildStrategy) &&
                input.trim() ? (
                  <p className="text-[10px] text-muted-foreground/80">
                    This looks complex. Planning first is recommended.
                  </p>
                ) : null}
              </div>
            )}
            <ComposerPromptQueue
              items={queuedPrompts}
              onCancel={cancelQueuedPrompt}
              onPause={pauseQueuedPrompt}
              onResume={resumeQueuedPrompt}
              onEdit={editQueuedPrompt}
            />
            <form
              ref={formRef}
              data-testid="create-composer-form"
              data-build-strategy={composerBuildStrategy}
              data-mode={mode}
              data-plan-first-enabled={planFirstEnabled ? "true" : "false"}
              data-can-enqueue-build={canEnqueueBuild ? "true" : "false"}
              data-queue-ready={queueReady ? "true" : "false"}
              data-queue-count={String(queueCount)}
              data-queue-disabled-reason={submitDisabledReason}
              data-active-project-id={effectiveProjectId ?? ""}
              className={cn("relative z-10 rounded-xl", modeStyle.composerWrap)}
              onInputCapture={handleComposerInputCapture}
              onSubmitCapture={handleFormSubmitCapture}
              onSubmit={handleFormSubmit}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-2.5 py-1">
                <ModelPicker value={modelId} onChange={setModelId} disabled={composerBlocked} placement="auto" />
              </div>
              <textarea
                id="dreamos-composer-prompt"
                ref={composerTextareaCallbackRef}
                name="composer-prompt"
                data-testid="workspace-composer-textarea"
                value={composerLiveText}
                onChange={(e) => {
                  applyComposerText(e.target.value);
                  submitDebug("create", "input changed", { len: e.target.value.length });
                }}
                onInput={(e) => applyComposerText(e.currentTarget.value)}
                onFocus={(e) => applyComposerText(e.currentTarget.value)}
                onPaste={(e) => applyComposerPaste(e, composerText, applyComposerText)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  applyComposerText(e.currentTarget.value);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing || isComposing) return;
                  if (e.shiftKey) return;
                  if (!canSendPrompt) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  uiSubmitLog("create-ui", "enter submit");
                  submitDebug("create", "enter pressed");
                  formRef.current?.requestSubmit();
                }}
                rows={2}
                placeholder={
                  isFirstCreatePrompt || mode === "build"
                    ? "Describe the app you want to create…"
                    : mode === "discuss"
                      ? "Ask anything…"
                      : "Describe the change…"
                }
                spellCheck
                className={cn(
                  composerTextareaClass,
                  "px-3 pb-1 pt-2.5 text-[13px] leading-relaxed",
                )}
              />
              <div className="flex items-center gap-1.5 px-2 pb-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-40"
                >
                  <Paperclip className="size-3.5" strokeWidth={1.75} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
                />
                <button
                  type="button"
                  suppressHydrationWarning
                  data-create-build-btn
                  data-testid="workspace-composer-submit"
                  data-build-strategy={composerBuildStrategy}
                  data-mode={mode}
                  data-plan-first-enabled={planFirstEnabled ? "true" : "false"}
                  data-can-enqueue-build={canEnqueueBuild ? "true" : "false"}
                  data-has-text={composerHasText || composerDomHasText ? "true" : "false"}
                  data-disabled-reason={submitDisabledReason}
                  data-dom-len={domLen}
                  data-state-len={stateLen}
                  data-live-len={liveLen}
                  disabled={!canSendPrompt}
                  onPointerDownCapture={() => {
                    setDebugClicked(true);
                    setSubmitStatusLabel("Pointer down detected");
                    uiSubmitLog("create-ui", "build pointer down");
                    submitDebug("create", "button pointer down");
                  }}
                  onClickCapture={() => {
                    setSubmitStatusLabel("Click detected");
                  }}
                  onClick={(e) => {
                    syncFromDom();
                    const text = resolveComposerPromptText();
                    if (!composerHasMeaningfulText(text)) {
                      return;
                    }
                    if (submitHardDisabled) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDebugClicked(true);
                    setSubmitStatusLabel("Click detected");
                    uiSubmitLog("create-ui", "build click");
                    submitDebug("create", "button click");
                    void runSubmitRef.current("button", undefined, {
                      queueOnly: e.shiftKey || buildJobActive,
                    });
                  }}
                  className={cn(
                    "relative z-[60] ml-auto flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition",
                    !canSendPrompt
                      ? "cursor-not-allowed bg-muted/60 text-muted-foreground opacity-50"
                      : "pointer-events-auto cursor-pointer active:scale-[0.98]",
                    canSendPrompt &&
                      (buildJobActive
                        ? "bg-muted/80 text-muted-foreground"
                        : mode === "build"
                          ? "bg-gradient-to-r from-accent to-violet-500 text-white shadow-[0_4px_14px_-4px_rgba(30,107,255,0.5)] hover:opacity-90"
                          : "bg-accent text-white hover:bg-accent/90"),
                  )}
                >
                  {showQueueAffordance ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-3.5" strokeWidth={2.25} />
                  )}
                  {showQueueAffordance
                    ? queueCount > 0
                      ? `Queue (${queueCount})`
                      : "Queue"
                    : mode === "build"
                    ? buildStrategy === "plan_first" && !blueprintApproved
                      ? "Create plan"
                      : "Build"
                    : "Send"}
                </button>
              </div>
            </form>
            {debugEnabled && (
              <>
                <p
                  data-testid="create-submit-status"
                  className={cn(
                    "mt-2 rounded-lg border px-2.5 py-2 text-[12px] font-semibold",
                    submitStatusLabel.startsWith("Failed")
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-border bg-surface text-foreground",
                  )}
                >
                  {submitStatusLabel}
                </p>
                <SubmitPipelinePanel channel="create" inputLen={input.length} mode={mode} />
              </>
            )}
            {autoStartFailed && (
              <div className="mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive lg:hidden">
                <p>{autoStartFailed}</p>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden bg-atmosphere",
            mobilePanel === "chat" && "max-lg:hidden",
          )}
        >
          <div className="hidden shrink-0 items-center gap-1 border-b border-border/60 bg-background/75 px-2 py-1.5 backdrop-blur-md lg:flex">
            {tabBtn("preview", "Preview", MonitorPlay)}
            {tabBtn("dashboard", "Dashboard", LayoutGrid, !effectiveProject?.id)}
            {tabBtn("mobile", "Mobile App", Smartphone, !effectiveProject?.id || codeFiles.length === 0)}
            {tabBtn("code", "Code", Code2)}
          </div>
          {effectiveProject?.id && integrationSecretKeys.length > 0 && (
            <div className="shrink-0 border-b border-border/60 bg-background/90 px-2 py-2">
              <IntegrationSecretsPanel projectId={effectiveProject.id} requiredKeys={integrationSecretKeys} />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            {rightTab === "preview" && (
              <div className="relative h-full min-h-0">
              <PreviewPanel
                url={previewFrameUrl}
                projectId={effectiveProjectId}
                projectMetadata={effectiveProject?.metadata}
                projectPreviewUrl={effectiveProject?.preview_url ?? null}
                projectFileCount={projectFiles.length}
                urlResolution={previewUrlResolution}
                onClearPreviewCache={effectiveProjectId ? handleClearPreviewCache : undefined}
                onRefreshRuntimeStatus={effectiveProjectId ? refreshPreviewRuntime : undefined}
                onRepairPreviewState={
                  effectiveProjectId ? () => void handleRepairPreviewState() : undefined
                }
                previewStateRepairing={previewStateRepairing}
                showPreviewDebug={process.env.NEXT_PUBLIC_PREVIEW_DEBUG === "true"}
                appName={effectiveProject?.name ?? null}
                buildActive={buildActive && !previewReadyForUi}
                thinking={(buildActive || (isBusy && !previewReadyForUi)) && !hardImportedPreviewReady}
                isBusy={isBusy}
                isImportedZip={isImportedZipProject}
                editMode={mode === "edit"}
                hasGenerated={
                  previewSrcRenderable ||
                  appBuildTruth.canPreview ||
                  (isImportedZipProject &&
                    ((zipImportMeta?.file_count ?? 0) > 0 ||
                      codeFiles.length > 0 ||
                      Boolean(previewRuntime?.previewRenderable)))
                }
                canPreview={appBuildTruth.canPreview}
                previewState={previewShellState}
                buildStepIndex={buildStepIndex}
                buildStepLabel={buildStepLabel}
                modelLabel={null}
                runtimeStatus={previewRuntime}
                previewRoutes={previewRoutes}
                previewRoute={previewRoute}
                onPreviewRouteChange={(path) => {
                  setPreviewRoute((prev) => (prev === path ? prev : path));
                }}
                onRebuildPreview={
                  effectiveProjectId ? () => void rebuildPreview() : undefined
                }
                onInnerRouteRepair={
                  effectiveProjectId ? () => void runInnerRouteRepair() : undefined
                }
                innerRouteRepairing={innerRouteRepairing}
                onStartPreview={
                  effectiveProjectId ? () => void startPreviewSession() : undefined
                }
                previewRebuilding={previewRebuilding}
                previewStarting={previewStarting}
                importedPreviewState={isImportedZipProject ? importedPreviewClassification : null}
                onPrepareImportedPreview={
                  isImportedZipProject ? () => void prepareImportedApp() : undefined
                }
                onRepairPreview={
                  effectiveProjectId &&
                  (appBuildTruth.showRepair || isImportedZipProject)
                    ? () => sendPreviewRepairToChat(true)
                    : undefined
                }
                prepareImportBusy={prepareImportBusy}
                onEditTarget={(info) => {
                  setEditTarget(info.section);
                  setScope(info.section.toLowerCase().replace(/\s+/g, "_") as EditScope);
                  applyComposerText(`Update the ${info.section}: `);
                  formRef.current?.querySelector("textarea")?.focus();
                }}
                className={cn(
                  "h-full rounded-[var(--radius-xl)] ring-1 ring-border",
                  previewIssue && !previewDismissed && "opacity-60",
                )}
              />
              {previewIssue &&
              !previewDismissed &&
              importedPreviewClassification.state !== "preview_loading" &&
              importedPreviewClassification.state !== "preview_not_started" &&
              importedPreviewClassification.state !== "preview_artifact_missing" &&
              (importedPreviewClassification.state === "preview_blocked_iframe" ||
                importedPreviewClassification.state === "preview_runtime_failed") ? (
                <PreviewBlockedPopup
                  issue={previewIssue}
                  repairPrompt={repairChatPrompt}
                  onFixInChat={sendPreviewRepairToChat}
                  onDismiss={() => setPreviewDismissed(true)}
                  variant={
                    importedPreviewClassification.state === "preview_blocked_iframe"
                      ? "iframe"
                      : "runtime"
                  }
                />
              ) : null}
              {effectiveProject?.id &&
              (effectiveProject.build_status === "needs_repair" ||
                effectiveProject.build_status === "preview_failed") ? (
                <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex max-w-[min(92vw,340px)] justify-end">
                  <div className="pointer-events-auto w-full">
                    <RepairCenter projectId={effectiveProject.id} compact defaultOpen={false} />
                  </div>
                </div>
              ) : null}
              </div>
            )}
            {rightTab === "dashboard" && effectiveProject?.id && (
              <div className="h-full min-h-0">
              <AppDashboardPanel
                project={effectiveProject}
                isBusy={isBusy}
                refreshKey={projectDataRefresh}
                planId={profile?.plan_id}
                activeSection={dashboardSection}
                onSectionChange={setDashboardSection}
                onOpenPublish={() => setPublishOpen(true)}
                onInsertChatPrompt={(prompt) => {
                  setMode("discuss");
                  setChatEngaged(true);
                  setMobilePanel("chat");
                  setComposerLiveText(prompt || SECRETS_HELPER_PROMPT);
                  toast.info("Secrets helper prompt added — press Send (~0.2 credits)");
                }}
              />
              </div>
            )}
            {rightTab === "code" && (
              <AppBuilderWorkspace
                projectId={effectiveProjectId}
                projectName={effectiveProject?.name ?? "App"}
                files={codeFiles.map((f) => ({ path: f.path, content: f.content }))}
                loading={projectFilesLoading && codeFiles.length === 0 && !filesReady}
                filesReady={filesReady}
                importedReady={importedReady}
                onPrepareImport={() => void prepareImportedApp()}
                prepareImportBusy={prepareImportBusy}
                blueprint={blueprint}
                previewUrl={effectiveProject?.preview_url ?? null}
                pendingDiffRefreshKey={pendingDiffRefresh}
                planId={profile?.plan_id}
                onFilesChanged={() => {
                  if (effectiveProjectId) {
                    invalidateProjectFilesCache(effectiveProjectId);
                    setProjectDataRefresh((n) => n + 1);
                  }
                }}
                className="h-full"
              />
            )}
            {rightTab === "mobile" && effectiveProject?.id && (
              <MobileWrapperStudio
                projectId={effectiveProject.id}
                projectName={
                  resolveProjectDisplayName({
                    app_name: (effectiveProject as { app_name?: string | null }).app_name,
                    name: effectiveProject.name,
                  })
                }
                planId={profile?.plan_id}
                fileCount={codeFiles.length}
                hasPreview={Boolean(effectiveProject.preview_url)}
                iconUrl={effectiveProject.icon_url}
                onAskForHelp={(prompt) => {
                  setRightTab("preview");
                  setMobilePanel("chat");
                  applyComposerText(prompt);
                  setMode("discuss");
                  formRef.current?.querySelector("textarea")?.focus();
                }}
              />
            )}
          </div>
        </div>
      </div>

      <PublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        projectId={effectiveProjectId}
        planId={profile?.plan_id}
        initialDraft={publishDraft}
        onSaved={(d) => setPublishDraft(d)}
        artifactsReady={publishReady || Boolean(effectiveProject?.preview_url)}
        onPublishPhaseChange={(phase, detail) => {
          setPublishPhase(phase);
          if (phase === "failed" && detail?.error) {
            toast.error(detail.error);
          }
          if (phase === "published" && detail?.url) {
            toast.success(`Deployed: ${detail.url}`);
          }
        }}
      />

      <AdminDiagnosticsFab
        projectId={effectiveProjectId}
        buildJobId={activeBuildJob?.jobId ?? null}
        diagnosticsOpen={ownerDiagOpen}
        onDiagnosticsOpenChange={setOwnerDiagOpen}
        diagnostics={ownerDiagPayload}
        onDiagnosticsLoaded={setOwnerDiagPayload}
        slowBanner={
          buildJobActive && buildStartedAtRef.current
            ? Date.now() - buildStartedAtRef.current > 120_000
              ? `Slow build: ${Math.round((Date.now() - buildStartedAtRef.current) / 1000)}s — open diagnostics`
              : null
            : null
        }
      />

      {effectiveProjectId ? (
        <VersionHistoryDrawer
          projectId={effectiveProjectId}
          open={versionDrawerOpen}
          onClose={() => setVersionDrawerOpen(false)}
          onOpenPublish={() => {
            setRightTab("dashboard");
            setDashboardSection("publish");
            setVersionDrawerOpen(false);
          }}
        />
      ) : null}

      {showFreeWatermark && (
        <div
          className="pointer-events-none fixed bottom-3 right-3 z-[var(--z-dropdown)] select-none rounded-lg bg-foreground/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background shadow-md backdrop-blur-sm"
          aria-hidden
        >
          Vodex
        </div>
      )}
    </DropZone>
  );
}
