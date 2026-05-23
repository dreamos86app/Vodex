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
};

const QUESTION_PATTERNS = [
  /^(what|why|how|when|where|who|which|can you explain|could you explain|tell me about|define)\b/i,
  /\?\s*$/,
  /\bwhat is\b/i,
  /\bhow does\b/i,
  /\bhow do i\b/i,
  /\bexplain\b/i,
];

const BUILD_PATTERNS = [
  /\b(build|create|make|generate|scaffold)\s+(me\s+)?(a|an|my)\s+/i,
  /\bbuild\s+(this|that)\s+app/i,
  /\bi want (a|an)\s+(app|saas|dashboard|crm|website|platform)\b/i,
  /\bturn this into an app\b/i,
];

const EDIT_PATTERNS = [
  /\b(change|update|fix|edit|modify|adjust|redesign)\s+(the|this|my)\b/i,
  /\bmake (the|this|my)\s+.+\s+(darker|lighter|responsive|mobile)\b/i,
  /\badd (a|the)\s+button\b/i,
];

const PUBLISH_PATTERNS = [/\b(publish|deploy|go live|ship it|launch)\b/i];
const PRICING_PATTERNS = [/\b(pricing|credits|cost|how much|subscription|plan)\b/i];
const SUPPORT_PATTERNS = [/\b(support|help|bug|broken|not working|error on)\b/i];
const DESIGN_PATTERNS = [/\b(design|ui|ux|wireframe|mockup|style)\b/i];

const UNSAFE = [/\b(hack|steal|bypass|illegal|malware)\b/i];

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

  if (PRICING_PATTERNS.some((p) => p.test(text)) && !BUILD_PATTERNS.some((p) => p.test(text))) {
    return {
      intent: "pricing_question",
      confidence: 0.85,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "See Pricing for credit packs — builds show estimated credits before you run.",
    };
  }

  if (SUPPORT_PATTERNS.some((p) => p.test(text)) && !BUILD_PATTERNS.some((p) => p.test(text))) {
    return {
      intent: "support_question",
      confidence: 0.8,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "Visit Help or contact support — we will not start a build for this message.",
    };
  }

  if (PUBLISH_PATTERNS.some((p) => p.test(text))) {
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
        : "Select an app to publish — we do not create a new app from a publish-only message.",
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

  if (BUILD_PATTERNS.some((p) => p.test(text)) && text.length > 24) {
    return {
      intent: "app_build_request",
      confidence: 0.9,
      shouldCreateProject: true,
      shouldReserveBuildCredits: true,
      shouldFullBuild: true,
      needsClarification: false,
      userMessage: "We will create your app record, design a blueprint, and wait for your approval before a full build.",
    };
  }

  if (DESIGN_PATTERNS.some((p) => p.test(text)) && !QUESTION_PATTERNS.some((p) => p.test(text))) {
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

  const isQuestion =
    QUESTION_PATTERNS.some((p) => p.test(text)) &&
    !BUILD_PATTERNS.some((p) => p.test(text)) &&
    text.length < 200;

  if (isQuestion) {
    return {
      intent: "question_only",
      confidence: 0.92,
      shouldCreateProject: false,
      shouldReserveBuildCredits: false,
      shouldFullBuild: false,
      needsClarification: false,
      userMessage: "This looks like a question — we will answer without starting a full app build.",
    };
  }

  if (text.length > 40 && !text.includes("?")) {
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
