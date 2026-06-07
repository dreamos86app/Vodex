/**
 * P1.3.7 — Unified task router for builder messages.
 * Maps user prompts to actionable routes with logging-friendly labels.
 */
import { classifyCreateIntent } from "@/lib/intent/create-intent-classifier";
import { classifyBuildIntent } from "@/lib/ai/build-intent-classifier";

export type TaskRoute =
  | "question_only"
  | "project_edit"
  | "project_build"
  | "project_repair"
  | "command";

export type TaskRouteResult = {
  route: TaskRoute;
  confidence: number;
  reason: string;
  shouldCreateProject: boolean;
  shouldStartBuildPipeline: boolean;
  shouldChargeBuildCredits: boolean;
  needsClarification: boolean;
  clarificationPrompt?: string;
};

const REPAIR_VERBS =
  /\b(fix|repair|resolve|debug|unblock|restore|heal)\b/i;
const REPAIR_PREVIEW =
  /\b(preview blocked|preview error|preview (not working|failed|stuck)|iframe blocked|build error|vite error|compile error)\b/i;
const EDIT_VERBS =
  /\b(change|update|edit|modify|adjust|tweak|redesign|add|remove|replace)\b/i;
const BUILD_VERBS =
  /\b(build|create|make|generate|scaffold|design and build)\s+(me\s+)?(a|an|my|this|the)\b/i;
const QUESTION_ONLY =
  /^(what|why|how|when|where|who|which|can you explain|could you explain|tell me about|define)\b/i;
const QUESTION_MARKERS = /\?\s*$|^\s*(what|why|how)\b/i;
const COMMAND_PATTERNS =
  /\b(prepare preview|run scan|publish app|deploy app|import zip|start preview|rebuild preview)\b/i;

function isQuestionWithoutRepairIntent(text: string): boolean {
  const hasRepair = REPAIR_VERBS.test(text) || REPAIR_PREVIEW.test(text);
  if (hasRepair) return false;
  if (QUESTION_ONLY.test(text)) return true;
  if (QUESTION_MARKERS.test(text) && !BUILD_VERBS.test(text)) return true;
  return false;
}

/** Route a message given optional existing project context. */
export function routeBuilderTask(
  prompt: string,
  opts?: { projectId?: string | null; hasFiles?: boolean; mode?: string },
): TaskRouteResult {
  const text = prompt.trim();
  const hasProject = Boolean(opts?.projectId);
  const hasFiles = opts?.hasFiles !== false;

  if (!text || text.length < 2) {
    return {
      route: "question_only",
      confidence: 0.5,
      reason: "empty_prompt",
      shouldCreateProject: false,
      shouldStartBuildPipeline: false,
      shouldChargeBuildCredits: false,
      needsClarification: true,
      clarificationPrompt: "What would you like to do with this app?",
    };
  }

  if (COMMAND_PATTERNS.test(text)) {
    return {
      route: "command",
      confidence: 0.9,
      reason: "explicit_command",
      shouldCreateProject: false,
      shouldStartBuildPipeline: false,
      shouldChargeBuildCredits: false,
      needsClarification: false,
    };
  }

  if (hasProject && hasFiles) {
    if (isQuestionWithoutRepairIntent(text)) {
      return {
        route: "question_only",
        confidence: 0.92,
        reason: "in_project_question",
        shouldCreateProject: false,
        shouldStartBuildPipeline: false,
        shouldChargeBuildCredits: false,
        needsClarification: false,
      };
    }

    if (REPAIR_VERBS.test(text) || REPAIR_PREVIEW.test(text)) {
      return {
        route: "project_repair",
        confidence: 0.9,
        reason: "repair_signals_in_project",
        shouldCreateProject: false,
        shouldStartBuildPipeline: true,
        shouldChargeBuildCredits: false,
        needsClarification: false,
      };
    }

    if (EDIT_VERBS.test(text) && !BUILD_VERBS.test(text)) {
      return {
        route: "project_edit",
        confidence: 0.88,
        reason: "edit_signals_in_project",
        shouldCreateProject: false,
        shouldStartBuildPipeline: true,
        shouldChargeBuildCredits: false,
        needsClarification: false,
      };
    }

    const buildIntent = classifyBuildIntent(text);
    if (buildIntent.intent === "discuss_question" || buildIntent.intent === "debug_help") {
      return {
        route: buildIntent.intent === "debug_help" && REPAIR_VERBS.test(text)
          ? "project_repair"
          : "question_only",
        confidence: buildIntent.confidence,
        reason: buildIntent.reason,
        shouldCreateProject: false,
        shouldStartBuildPipeline: false,
        shouldChargeBuildCredits: false,
        needsClarification: false,
      };
    }

    if (buildIntent.intent === "edit_app") {
      return {
        route: "project_edit",
        confidence: buildIntent.confidence,
        reason: buildIntent.reason,
        shouldCreateProject: false,
        shouldStartBuildPipeline: true,
        shouldChargeBuildCredits: false,
        needsClarification: false,
      };
    }

    if (buildIntent.intent === "build_app" && !hasProject) {
      /* fall through to create */
    } else if (buildIntent.intent === "build_app") {
      return {
        route: "project_build",
        confidence: buildIntent.confidence,
        reason: "build_in_existing_project",
        shouldCreateProject: false,
        shouldStartBuildPipeline: true,
        shouldChargeBuildCredits: true,
        needsClarification: false,
      };
    }
  }

  const create = classifyCreateIntent(text, hasProject);

  if (create.intent === "question_only" || create.shouldAnswerQuestion) {
    return {
      route: "question_only",
      confidence: create.confidence,
      reason: "create_intent_question_only",
      shouldCreateProject: false,
      shouldStartBuildPipeline: false,
      shouldChargeBuildCredits: false,
      needsClarification: false,
    };
  }

  if (create.intent === "app_edit_request") {
    return {
      route: "project_edit",
      confidence: create.confidence,
      reason: "create_intent_edit",
      shouldCreateProject: hasProject,
      shouldStartBuildPipeline: hasProject,
      shouldChargeBuildCredits: false,
      needsClarification: create.needsClarification,
      clarificationPrompt: create.clarificationPrompt,
    };
  }

  if (create.shouldFullBuild || create.intent === "app_build_request") {
    return {
      route: "project_build",
      confidence: create.confidence,
      reason: "create_intent_build",
      shouldCreateProject: create.shouldCreateProject,
      shouldStartBuildPipeline: true,
      shouldChargeBuildCredits: create.shouldReserveBuildCredits,
      needsClarification: create.needsClarification,
      clarificationPrompt: create.clarificationPrompt,
    };
  }

  return {
    route: "question_only",
    confidence: 0.7,
    reason: "default_safe_answer",
    shouldCreateProject: false,
    shouldStartBuildPipeline: false,
    shouldChargeBuildCredits: false,
    needsClarification: create.needsClarification,
    clarificationPrompt: create.clarificationPrompt,
  };
}
