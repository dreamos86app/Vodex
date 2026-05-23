import type { ChatMode } from "@/lib/ai/chat-mode-policy";
import { getSafeProductContext } from "@/lib/ai/safe-product-context";

export function buildDiscussSystemPrompt(args: {
  projectMemoryBlock?: string;
  hasProject: boolean;
}): string {
  const memory = args.projectMemoryBlock?.trim()
    ? `\n\n---\nExisting project context:\n${args.projectMemoryBlock}\n---`
    : "";

  return [
    getSafeProductContext("discuss"),
    "",
    "You are DreamOS86's assistant in DISCUSS mode.",
    "Use your full general world knowledge for technical questions, but stay accurate about DreamOS86 product behavior.",
    "",
    "DISCUSS mode rules (mandatory):",
    "- Answer product questions clearly with bullets or steps when helpful.",
    "- Explain credits in user-safe language: charged after successful AI work; reservation + reconciliation on cancel.",
    "- NEVER claim you built, edited, or published an app from this chat.",
    "- For build requests: explain Create (/create) and intent confirmation.",
    "- For edit requests: explain Builder pending diff + accept flow.",
    "- For publish requests: explain preview readiness and /p/slug path-mode URLs.",
    "- Refuse revenue margins, provider costs, profit multipliers, RPC, and internal routing — offer billing help instead.",
    "- For 'what model are you using?': say DreamOS86 selects an efficient model for Discuss; routing details are not shown.",
    "- For ZIP import: explain deterministic scan, skipped folders, and optional AI repair only if quoted.",
    "- Do not dump full app source; snippets only when explicitly requested.",
    args.hasProject ? "- User has an active project — tie guidance to that app when useful." : "",
    memory,
  ]
    .filter((l) => l !== undefined && l !== "")
    .join("\n");
}

export function buildEditSystemPrompt(args: {
  scope?: string | null;
  projectMemoryBlock?: string;
}): string {
  const scopeContext = args.scope
    ? `Editing scope: "${args.scope}". Focus changes on this scope only.`
    : "Surgical edit — minimal change set.";

  const memory = args.projectMemoryBlock?.trim()
    ? `\n\n---\nProject context:\n${args.projectMemoryBlock}\n---`
    : "";

  return [
    getSafeProductContext("edit"),
    "",
    "You are DreamOS86 in EDIT mode.",
    scopeContext,
    "",
    "EDIT mode rules:",
    "- Summarize the change in plain language first.",
    "- Propose changes as pending diff — do NOT claim files changed until user accepts.",
    "- Checkpoint is saved before apply.",
    "- Put full code in fenced blocks with file= paths.",
    memory,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBuildSystemPrompt(args: {
  projectMemoryBlock?: string;
  hasProject: boolean;
}): string {
  const memory = args.projectMemoryBlock?.trim()
    ? `\n\n---\nExisting project:\n${args.projectMemoryBlock}\n---`
    : "";

  return [
    getSafeProductContext("build"),
    "",
    "You are DreamOS86 in BUILD mode — generate through the real staged pipeline.",
    "Follow intent gate: question-only prompts must not start builds.",
    hasProjectLine(args.hasProject),
    memory,
  ]
    .filter(Boolean)
    .join("\n");
}

function hasProjectLine(hasProject: boolean): string {
  return hasProject
    ? "Build ON TOP of the existing project architecture."
    : "New project — complete, production-ready output.";
}

export function buildSystemPromptForMode(
  mode: ChatMode,
  args: {
    scope?: string | null;
    projectMemoryBlock?: string;
    hasProject: boolean;
  },
): string {
  if (mode === "build") return buildBuildSystemPrompt(args);
  if (mode === "edit") return buildEditSystemPrompt(args);
  return buildDiscussSystemPrompt(args);
}
