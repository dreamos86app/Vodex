export type BuildIntent =
  | "build_app"
  | "edit_app"
  | "discuss_question"
  | "support_answer"
  | "debug_help"
  | "publish_help"
  | "clarification_needed";

/** @deprecated — use BuildIntent */
export type LegacyBuildIntent = BuildIntent;

export type BuildIntentResult = {
  intent: BuildIntent;
  confidence: number;
  reason: string;
};

const GREETING = /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay)[\s!.?]*$/i;
const TEST_ONLY = /^(test|testing|asdf|foo|bar|demo)[\s!.?]*$/i;
const PRODUCT_PLATFORM =
  /\b(how much does vodex|vodex pricing|vodex credits|my plan credits|platform billing)\b/i;
const DEBUG =
  /\b(bug|broken|not working|error|slow|crash|blank screen|preview stuck|why is my app|debug|fix preview|compile)\b/i;
const PUBLISH =
  /\b(publish|deploy|subdomain|custom domain|go live|production url|vercel)\b/i;
const SUPPORT =
  /\b(support team|customer support|contact support|contact us|help desk|refund policy for dreamos)\b/i;
export const BUILD_VERBS =
  /\b(build|create|make|generate|design|develop|scaffold|implement|ship|launch|add a|add an)\b/i;
export const APP_NOUNS =
  /\b(app|application|website|site|portfolio|landing page|dashboard|portal|platform|tool|saas|store|marketplace|calculator|tracker|crm|blog|chatbot|todo|checkout|booking|ticket)\b/i;
const EDIT_VERBS =
  /\b(edit|update|change|fix the|modify|refactor|improve|tweak|adjust|make it darker|make it lighter|change layout|change the button)\b/i;
const QUESTION_START =
  /^(how|what|why|when|where|who|can i|should i|is there|do i)\b/i;
export function classifyBuildIntent(prompt: string): BuildIntentResult {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  if (!text) {
    return { intent: "clarification_needed", confidence: 0.95, reason: "empty_prompt" };
  }

  if (TEST_ONLY.test(text) || GREETING.test(text)) {
    return { intent: "discuss_question", confidence: 0.94, reason: "greeting_or_test" };
  }

  if (
    EDIT_VERBS.test(lower) &&
    (APP_NOUNS.test(lower) || /\b(this|my|the)\s+(app|project|screen|page|button|layout)\b/i.test(lower))
  ) {
    return { intent: "edit_app", confidence: 0.85, reason: "edit_request" };
  }

  if (
    QUESTION_START.test(lower) &&
    !BUILD_VERBS.test(lower) &&
    !/\b(build|create|make|generate)\s+(me\s+)?(a|an|my)\b/i.test(lower)
  ) {
    return { intent: "discuss_question", confidence: 0.88, reason: "question_without_build_verb" };
  }

  if (BUILD_VERBS.test(lower)) {
    const confidence = APP_NOUNS.test(lower) ? 0.92 : 0.88;
    return { intent: "build_app", confidence, reason: "build_verb" };
  }

  if (APP_NOUNS.test(lower) && text.split(/\s+/).length >= 6 && !/\?\s*$/.test(text)) {
    return { intent: "build_app", confidence: 0.78, reason: "detailed_app_description" };
  }

  if (PUBLISH.test(lower) && !BUILD_VERBS.test(lower)) {
    return { intent: "publish_help", confidence: 0.86, reason: "publish_question" };
  }

  if (DEBUG.test(lower) && !BUILD_VERBS.test(lower)) {
    if (/\b(fix|repair|resolve)\b/i.test(lower)) {
      return { intent: "edit_app", confidence: 0.86, reason: "repair_action_in_project" };
    }
    if (QUESTION_START.test(lower) || /\?\s*$/.test(text)) {
      return { intent: "discuss_question", confidence: 0.9, reason: "debug_question_not_repair" };
    }
    return { intent: "debug_help", confidence: 0.84, reason: "debug_or_quality_question" };
  }

  if (PRODUCT_PLATFORM.test(lower) && !BUILD_VERBS.test(lower)) {
    return { intent: "discuss_question", confidence: 0.9, reason: "platform_product_question" };
  }

  if (QUESTION_START.test(lower) && !BUILD_VERBS.test(lower) && !APP_NOUNS.test(lower)) {
    return { intent: "discuss_question", confidence: 0.8, reason: "general_question" };
  }

  if (text.length < 14 && !BUILD_VERBS.test(lower) && !APP_NOUNS.test(lower)) {
    return { intent: "discuss_question", confidence: 0.78, reason: "too_short_for_build" };
  }

  if (SUPPORT.test(lower) && !BUILD_VERBS.test(lower) && !APP_NOUNS.test(lower)) {
    return { intent: "support_answer", confidence: 0.82, reason: "support_signals" };
  }

  if (text.split(/\s+/).length >= 12 && APP_NOUNS.test(lower)) {
    return { intent: "build_app", confidence: 0.62, reason: "detailed_app_description" };
  }

  return { intent: "discuss_question", confidence: 0.72, reason: "no_clear_app_request" };
}

/** True when build mode should create jobs / save generated app files. */
export function shouldStartBuildPipeline(
  mode: string,
  intent: BuildIntentResult | null,
): boolean {
  if (mode !== "build") return false;
  if (!intent) return false;
  return intent.intent === "build_app" || intent.intent === "edit_app";
}

/** Existing project builder: same bar as new builds — only explicit build/edit requests. */
export function shouldStartBuildPipelineInProject(
  mode: string,
  projectId: string | null | undefined,
  prompt: string,
): boolean {
  if (mode !== "build" || !projectId) return false;
  const text = prompt.trim();
  if (text.length < 3) return false;
  if (/^(hi|hello|hey|thanks|test|ok)[\s!.?]*$/i.test(text)) return false;
  return shouldStartBuildPipeline(mode, classifyBuildIntent(text));
}
