import type { ProjectLifecycleStatus } from "@/lib/projects/project-lifecycle";

/** Canonical create funnel states — UI must not invent other strings. */
export type CreateFlowState =
  | "idle"
  | "classifying_intent"
  | "intent_ready"
  | "needs_clarification"
  | "project_creating"
  | "project_ready"
  | "blueprint_generating"
  | "blueprint_ready"
  | "quote_ready"
  | "awaiting_build_confirmation"
  | "build_queued"
  | "building"
  | "generated"
  | "preview_ready"
  | "needs_attention"
  | "failed";

export type CreateFlowUiStep =
  | "idea"
  | "intent"
  | "template"
  | "blueprint"
  | "quote"
  | "confirm"
  | "progress"
  | "handoff";

export type CreateFlowAction =
  | "edit_prompt"
  | "continue_idea"
  | "continue_intent"
  | "select_template"
  | "generate_blueprint"
  | "approve_blueprint"
  | "fetch_quote"
  | "confirm_build"
  | "cancel_build"
  | "open_builder"
  | "retry";

type Transition = {
  next: CreateFlowState[];
  uiStep: CreateFlowUiStep;
  requiresProjectId: boolean;
  requiresBlueprint: boolean;
  allowed: CreateFlowAction[];
  blocked: CreateFlowAction[];
};

export const CREATE_FLOW_TRANSITIONS: Record<CreateFlowState, Transition> = {
  idle: {
    next: ["classifying_intent"],
    uiStep: "idea",
    requiresProjectId: false,
    requiresBlueprint: false,
    allowed: ["edit_prompt", "continue_idea"],
    blocked: ["confirm_build", "open_builder"],
  },
  classifying_intent: {
    next: ["intent_ready", "needs_clarification", "project_creating"],
    uiStep: "idea",
    requiresProjectId: false,
    requiresBlueprint: false,
    allowed: [],
    blocked: ["confirm_build", "generate_blueprint"],
  },
  intent_ready: {
    next: ["project_creating", "project_ready", "needs_clarification"],
    uiStep: "intent",
    requiresProjectId: false,
    requiresBlueprint: false,
    allowed: ["edit_prompt", "continue_intent"],
    blocked: ["confirm_build"],
  },
  needs_clarification: {
    next: ["classifying_intent", "idle"],
    uiStep: "intent",
    requiresProjectId: false,
    requiresBlueprint: false,
    allowed: ["edit_prompt", "continue_idea"],
    blocked: ["confirm_build", "generate_blueprint"],
  },
  project_creating: {
    next: ["project_ready", "failed"],
    uiStep: "intent",
    requiresProjectId: false,
    requiresBlueprint: false,
    allowed: [],
    blocked: ["confirm_build"],
  },
  project_ready: {
    next: ["blueprint_generating"],
    uiStep: "template",
    requiresProjectId: true,
    requiresBlueprint: false,
    allowed: ["select_template", "generate_blueprint"],
    blocked: ["confirm_build"],
  },
  blueprint_generating: {
    next: ["blueprint_ready", "failed"],
    uiStep: "blueprint",
    requiresProjectId: true,
    requiresBlueprint: false,
    allowed: [],
    blocked: ["confirm_build"],
  },
  blueprint_ready: {
    next: ["quote_ready", "awaiting_build_confirmation"],
    uiStep: "blueprint",
    requiresProjectId: true,
    requiresBlueprint: true,
    allowed: ["approve_blueprint", "generate_blueprint"],
    blocked: ["confirm_build"],
  },
  quote_ready: {
    next: ["awaiting_build_confirmation"],
    uiStep: "quote",
    requiresProjectId: true,
    requiresBlueprint: true,
    allowed: ["fetch_quote"],
    blocked: [],
  },
  awaiting_build_confirmation: {
    next: ["build_queued", "building"],
    uiStep: "confirm",
    requiresProjectId: true,
    requiresBlueprint: true,
    allowed: ["confirm_build", "cancel_build"],
    blocked: ["generate_blueprint"],
  },
  build_queued: {
    next: ["building", "failed"],
    uiStep: "progress",
    requiresProjectId: true,
    requiresBlueprint: true,
    allowed: [],
    blocked: ["confirm_build"],
  },
  building: {
    next: ["generated", "preview_ready", "needs_attention", "failed"],
    uiStep: "progress",
    requiresProjectId: true,
    requiresBlueprint: true,
    allowed: [],
    blocked: ["confirm_build"],
  },
  generated: {
    next: ["preview_ready"],
    uiStep: "handoff",
    requiresProjectId: true,
    requiresBlueprint: true,
    allowed: ["open_builder"],
    blocked: ["confirm_build"],
  },
  preview_ready: {
    next: [],
    uiStep: "handoff",
    requiresProjectId: true,
    requiresBlueprint: true,
    allowed: ["open_builder"],
    blocked: ["confirm_build"],
  },
  needs_attention: {
    next: ["building", "blueprint_generating", "failed"],
    uiStep: "progress",
    requiresProjectId: true,
    requiresBlueprint: false,
    allowed: ["retry", "open_builder"],
    blocked: [],
  },
  failed: {
    next: ["idle", "blueprint_generating"],
    uiStep: "progress",
    requiresProjectId: false,
    requiresBlueprint: false,
    allowed: ["retry", "edit_prompt"],
    blocked: ["confirm_build"],
  },
};

// Fix generated state next array - handoff isn't a state
CREATE_FLOW_TRANSITIONS.generated.next = ["preview_ready"];

export function canTransitionCreateFlow(from: CreateFlowState, to: CreateFlowState): boolean {
  return CREATE_FLOW_TRANSITIONS[from].next.includes(to);
}

export function uiStepForFlowState(state: CreateFlowState): CreateFlowUiStep {
  return CREATE_FLOW_TRANSITIONS[state].uiStep;
}

export function isActionAllowed(state: CreateFlowState, action: CreateFlowAction): boolean {
  const t = CREATE_FLOW_TRANSITIONS[state];
  if (t.blocked.includes(action)) return false;
  if (t.allowed.length === 0 && action !== "retry") return false;
  return t.allowed.includes(action) || action === "retry";
}

const TERMINAL_BUILD: ProjectLifecycleStatus[] = [
  "generated",
  "preview_ready",
  "publish_ready",
  "published",
];

export function flowStateFromLifecycle(input: {
  lifecycle: ProjectLifecycleStatus;
  fileCount: number;
  blueprintApproved: boolean;
  isStreaming: boolean;
  localPhase?: CreateFlowState | null;
}): CreateFlowState {
  if (input.localPhase) {
    const local = input.localPhase;
    if (
      [
        "classifying_intent",
        "project_creating",
        "blueprint_generating",
        "quote_ready",
        "awaiting_build_confirmation",
      ].includes(local)
    ) {
      return local;
    }
  }

  if (input.isStreaming) return "building";
  if (input.lifecycle === "failed") return "failed";
  if (input.lifecycle === "needs_attention") return "needs_attention";
  if (TERMINAL_BUILD.includes(input.lifecycle)) {
    return input.lifecycle === "preview_ready" ? "preview_ready" : "generated";
  }
  if (input.lifecycle === "building" || input.lifecycle === "build_queued") return "building";
  if (input.blueprintApproved && input.lifecycle === "blueprint_approved") {
    return "awaiting_build_confirmation";
  }
  if (input.lifecycle === "blueprint_ready" && input.blueprintApproved) return "blueprint_ready";
  if (input.lifecycle === "blueprint_ready" || input.lifecycle === "blueprint_generating") {
    return input.blueprintApproved ? "blueprint_ready" : "blueprint_generating";
  }
  if (input.fileCount > 0 && TERMINAL_BUILD.includes(input.lifecycle)) return "generated";
  if (input.lifecycle === "intent_review") return "project_ready";
  return "idle";
}

export const CREATE_FLOW_STEP_LABELS: Record<CreateFlowUiStep, string> = {
  idea: "Describe your app",
  intent: "Intent review",
  template: "Choose a starting point",
  blueprint: "Review the blueprint",
  quote: "Build depth",
  confirm: "Choose build depth",
  progress: "Build progress",
  handoff: "Open builder",
};

export const CREATE_FLOW_STEP_ORDER: CreateFlowUiStep[] = [
  "idea",
  "intent",
  "template",
  "blueprint",
  "quote",
  "confirm",
  "progress",
  "handoff",
];
