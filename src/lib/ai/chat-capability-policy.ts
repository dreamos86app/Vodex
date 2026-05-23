import type { ChatMode } from "@/lib/ai/chat-mode-policy";

export type CapabilityCheck = {
  allowed: boolean;
  reason: string;
};

/** Whether the assistant may claim it mutated project files. */
export function canClaimFileMutation(mode: ChatMode, diffApplied: boolean): CapabilityCheck {
  if (mode === "discuss") {
    return {
      allowed: false,
      reason: "Discuss mode cannot mutate files — redirect to Builder with pending diff flow.",
    };
  }
  if (mode === "edit" && !diffApplied) {
    return {
      allowed: false,
      reason: "Edit mode creates pending diffs; claim changes only after user accepts.",
    };
  }
  return { allowed: true, reason: "Mutation claim permitted after successful apply." };
}

/** Whether the assistant may claim it created or published an app. */
export function canClaimAppLifecycle(
  mode: ChatMode,
  action: "create" | "publish",
  pipelineStarted: boolean,
): CapabilityCheck {
  if (action === "create") {
    if (mode !== "build" || !pipelineStarted) {
      return {
        allowed: false,
        reason: "App creation requires Build mode with confirmed intent in Create.",
      };
    }
    return { allowed: true, reason: "Build pipeline started." };
  }
  return {
    allowed: false,
    reason: "Publish always happens in-product via the publish flow, not chat claims.",
  };
}

const SECRET_PATTERNS = [
  /revenue\s*margin/i,
  /profit\s*margin/i,
  /3\s*[×x]\s*profit/i,
  /provider\s*cost/i,
  /internal\s*cost/i,
  /service[_\s-]?role/i,
  /TARGET_REVENUE_MULTIPLIER/i,
  /charge_tokens/i,
  /\bRPC\b/i,
  /model\s*routing/i,
  /ledger\s*hardening/i,
  /gross\s*margin/i,
];

/** Returns true if user question targets confidential internals. */
export function isConfidentialQuestion(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

export function confidentialRefusal(): string {
  return "I can't share internal billing economics or infrastructure details. I can explain how **credits** work for your account and where to manage billing in Settings.";
}
