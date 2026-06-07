/**
 * First Create prompt intent — question vs build vs ambiguous.
 * Used on /create before any project row or build credit reservation.
 */
import { classifyBuildIntent } from "@/lib/ai/build-intent-classifier";

export type CreateIntent =
  | "question_only"
  | "app_idea"
  | "app_build_request"
  | "app_edit_request"
  | "design_request"
  | "publish_request"
  | "pricing_question"
  | "support_question"
  | "ambiguous"
  | "unsafe_or_invalid";

export type CreateIntentResult = {
  intent: CreateIntent;
  confidence: number;
  shouldCreateProject: boolean;
  shouldReserveBuildCredits: boolean;
  shouldFullBuild: boolean;
  needsClarification: boolean;
  clarificationPrompt?: string;
  userMessage: string;
  /** True when user should get a flat-priced answer on Create (no project). */
  shouldAnswerQuestion?: boolean;
};

const QUESTION_START =
  /^(what|why|how|when|where|who|which|can you explain|could you explain|tell me about|define|do i need|does vodex)\b/i;

const QUESTION_MARKERS = [
  /\?\s*$/,
  /\bwhat is\b/i,
  /\bwhat's the difference\b/i,
  /\bhow does\b/i,
  /\bhow do i\b/i,
  /\bhow much\b/i,
  /\bcan i\b/i,
  /\bcan you\b/i,
  /\bcan dreamos/i,
  /\bis (that|it|this) possible\b/i,
  /\bexplain\b/i,
  /\btell me\b/i,
];

const CAPABILITY_QUESTION =
  /\b(can (you|vodex|i)|is it possible|are you able|do you support|does vodex)\b/i;

const IDEA_REQUEST =
  /\b(give me|suggest|recommend|list|share|show me|brainstorm|ideas? for|what should i build|which app should|what app should|what kind of app|what type of app)\b/i;

const BUILD_VERBS = /\b(build|create|make|generate|scaffold|design and build)\s+(me\s+)?(a|an|my|this|the)\b/i;
const BUILD_IMPERATIVE = /\b(build|create|make|generate)\s+(me\s+)?(a|an|my)\s+\w/i;
const BUILD_FROM_IDEA = /\b(generate an app|turn this into|from this idea)\b/i;
const APP_WANT = /\bi want (a|an|to build)\s+(app|saas|dashboard|crm|website|platform|landing)\b/i;

const EDIT_PATTERNS = [
  /\b(change|update|fix|edit|modify|adjust|redesign)\s+(the|this|my)\b/i,
  /\bmake (the|this|my)\s+.+\s+(darker|lighter|responsive|mobile)\b/i,
];

const PUBLISH_PATTERNS = [/\b(publish|deploy|go live|ship it|launch)\b/i];
const PRICING_PATTERNS = [/\b(pricing|credits|cost|how much|subscription|plan|starter|pro)\b/i];
const SUPPORT_PATTERNS = [/\b(support|help|bug|broken|not working|error on)\b/i];
const DESIGN_ONLY = /\b(design|wireframe|mockup)\b/i;
const IMPORT_QUESTION = /\b(import.*zip|zip import|upload.*zip)\b/i;
const SUPABASE_QUESTION = /\b(supabase|database provider)\b/i;
const PUBLISH_EXPLAIN = /\b(explain.*publish|how.*publish|publishing works)\b/i;
const PREVIEW_QUESTION =
  /\b(why is preview|what does preview blocked|preview blocked mean|why can't i preview|what should i do about preview)\b/i;
const REPAIR_ACTION =
  /\b(fix|repair|resolve|unblock)\b.+\b(preview|blocked|error|build)\b/i;

const UNSAFE = [/\b(hack|steal|bypass|illegal|malware)\b/i];

const POSSIBLE_BUT_UNCERTAIN =
  /\b(i want|i'd like|thinking about).+(possible|can you|could you)\b/i;

function hasBuildSignals(text: string): boolean {
  return (
    BUILD_VERBS.test(text) ||
    BUILD_IMPERATIVE.test(text) ||
    BUILD_FROM_IDEA.test(text) ||
    APP_WANT.test(text)
  );
}

function hasQuestionSignals(text: string): boolean {
  return QUESTION_START.test(text) || QUESTION_MARKERS.some((p) => p.test(text));
}

function baseQuestionResult(userMessage: string, confidence = 0.92): CreateIntentResult {
  return {
    intent: "question_only",
    confidence,
    shouldCreateProject: false,
    shouldReserveBuildCredits: false,
    shouldFullBuild: false,
    needsClarification: false,
    shouldAnswerQuestion: true,
    userMessage,
  };
}

/** Canonical first-prompt classifier for the Create page. */
export function classifyFirstCreatePrompt(prompt: string): CreateIntentResult {
  return classifyCreateIntent(prompt, false);
}

export function classifyCreateIntent(prompt: string, hasProjectId: boolean): CreateIntentResult {
  const text = prompt.trim();
  if (!text || text.length < 3) {
    return {
      intent: "ambiguous",
      confidence: 0.5,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: true,
      clarificationPrompt: "Describe the app you want to build in one or two sentences.",
      userMessage: "Add a bit more detail so we know what to build.",
    };
  }

  if (UNSAFE.some((p) => p.test(text))) {
    return {
      intent: "unsafe_or_invalid",
      confidence: 0.9,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "This request cannot be processed.",
    };
  }

  const buildSignals = hasBuildSignals(text);
  const questionSignals = hasQuestionSignals(text);
  const buildIntent = classifyBuildIntent(text);

  if (IDEA_REQUEST.test(text) && !BUILD_IMPERATIVE.test(text)) {
    return baseQuestionResult(
      "Happy to help with ideas — answer in chat without creating an app. Say “Build me …” when you want to start.",
      0.93,
    );
  }

  if (POSSIBLE_BUT_UNCERTAIN.test(text) && !BUILD_IMPERATIVE.test(text)) {
    return {
      intent: "ambiguous",
      confidence: 0.78,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: true,
      shouldAnswerQuestion: true,
      clarificationPrompt:
        "Yes — Vodex can build apps like that. Want me to start a blueprint? Reply with a clear build request (e.g. “Build me an app like Airbnb for …”).",
      userMessage:
        "This sounds like a feasibility question. I can answer briefly — say “Build me …” when you are ready to create the app.",
    };
  }

  if (buildSignals && questionSignals) {
    if (BUILD_IMPERATIVE.test(text) || BUILD_FROM_IDEA.test(text)) {
      return {
        intent: "app_build_request",
        confidence: 0.88,
        shouldCreateProject: true,
        shouldReserveBuildCredits: true,
        shouldFullBuild: true,
        needsClarification: false,
        userMessage:
          "Build request detected — we will create your app record and prepare a blueprint for approval.",
      };
    }
    return baseQuestionResult(
      "I can answer your question first. When you are ready to build, send a clear build request (e.g. “Build me a CRM for dentists”).",
      0.8,
    );
  }

  if (
    !hasProjectId &&
    (PRICING_PATTERNS.some((p) => p.test(text)) ||
      IMPORT_QUESTION.test(text) ||
      SUPABASE_QUESTION.test(text) ||
      PUBLISH_EXPLAIN.test(text) ||
      CAPABILITY_QUESTION.test(text)) &&
    !buildSignals
  ) {
    return baseQuestionResult(
      "Quick answer from Create — no app will be created until you send a build request.",
    );
  }

  if (hasProjectId && PREVIEW_QUESTION.test(text) && !REPAIR_ACTION.test(text)) {
    return baseQuestionResult(
      "This is a question about preview — we will answer without starting a build or changing files.",
      0.94,
    );
  }

  if (hasProjectId && REPAIR_ACTION.test(text)) {
    return {
      intent: "app_edit_request",
      confidence: 0.92,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "Repair request — we will inspect files and apply a patch directly.",
    };
  }

  /** Inside an existing app builder — edit/repair vs full build. */
  if (hasProjectId && buildIntent.intent === "edit_app") {
    return {
      intent: "app_edit_request",
      confidence: buildIntent.confidence,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "We will apply edits directly to this app.",
    };
  }

  if (hasProjectId && buildSignals && buildIntent.intent === "build_app") {
    return {
      intent: "app_build_request",
      confidence: 0.9,
      shouldCreateProject: false,
      shouldReserveBuildCredits: true,
      shouldFullBuild: true,
      needsClarification: false,
      userMessage: "Build started for this app.",
    };
  }

  if (SUPPORT_PATTERNS.some((p) => p.test(text)) && !buildSignals) {
    return {
      intent: "support_question",
      confidence: 0.8,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      shouldAnswerQuestion: true,
      userMessage: "Support question — we will answer without starting a build.",
    };
  }

  if (PUBLISH_PATTERNS.some((p) => p.test(text)) && !buildSignals) {
    return {
      intent: "publish_request",
      confidence: 0.85,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: !hasProjectId,
      clarificationPrompt: hasProjectId ? undefined : "Open an existing app first, then publish from the dashboard.",
      userMessage: hasProjectId
        ? "Use Publish from your app dashboard when generation is complete."
        : "Publishing is explained without creating a new app from this message.",
      shouldAnswerQuestion: !hasProjectId,
    };
  }

  if (EDIT_PATTERNS.some((p) => p.test(text))) {
    return {
      intent: "app_edit_request",
      confidence: 0.88,
      shouldCreateProject: false,
      shouldReserveBuildCredits: true,
      shouldFullBuild: false,
      needsClarification: !hasProjectId,
      clarificationPrompt: "Open the app you want to edit in the builder first.",
      userMessage: hasProjectId
        ? "We will prepare edits as a reviewable diff."
        : "Open an existing app in the builder to edit it.",
    };
  }

  if (questionSignals && !buildSignals) {
    return baseQuestionResult(
      "This looks like a question — we will answer without creating an app or using build credits.",
    );
  }

  if (
    buildSignals ||
    (buildIntent.intent === "build_app" && buildIntent.confidence >= 0.85)
  ) {
    return {
      intent: "app_build_request",
      confidence: buildIntent.confidence >= 0.8 ? 0.92 : 0.82,
      shouldCreateProject: true,
      shouldReserveBuildCredits: true,
      shouldFullBuild: true,
      needsClarification: false,
      userMessage:
        "We will create your app record, design a blueprint, and wait for your approval before a full build.",
    };
  }

  if (DESIGN_ONLY.test(text) && !questionSignals) {
    return {
      intent: "design_request",
      confidence: 0.75,
      shouldCreateProject: true,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "We will capture this as an app idea and prepare a blueprint first.",
    };
  }

  if (text.length > 40 && !text.includes("?") && !IDEA_REQUEST.test(text)) {
    return {
      intent: "app_idea",
      confidence: 0.7,
      shouldCreateProject: true,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "We will save this as a draft app and prepare a blueprint for your review.",
    };
  }

  if (text.length < 20) {
    return {
      intent: "ambiguous",
      confidence: 0.6,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: true,
      shouldAnswerQuestion: true,
      clarificationPrompt: "Do you want to build a new app, edit an existing one, or just ask a question?",
      userMessage: "Please clarify before we use build credits.",
    };
  }

  return {
    intent: "app_idea",
    confidence: 0.65,
    shouldCreateProject: true,
    shouldReserveBuildCredits: false,
    shouldFullBuild: false,
    needsClarification: false,
    userMessage: "Saved as an app idea — review the blueprint before a full build.",
  };
}

/** Intents that receive Create-page flat question pricing (no project). */
export function isCreateQuestionIntent(intent: CreateIntent): boolean {
  return (
    intent === "question_only" ||
    intent === "pricing_question" ||
    intent === "support_question"
  );
}

export function shouldChargeCreateQuestion(intent: CreateIntentResult): boolean {
  return Boolean(intent.shouldAnswerQuestion) || isCreateQuestionIntent(intent.intent);
}
