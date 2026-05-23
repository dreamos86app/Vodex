import { createHash } from "crypto";

const BANNED_REFS = ["xycqutvqxtkbszytaxbe"];

export function sha256Short(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function fingerprintFile(path: string, content: string): string {
  return sha256Short(`${path}\n${content.length}\n${content.slice(0, 2000)}`);
}

export function hashPromptBlueprintKey(parts: {
  prompt: string;
  templateId?: string | null;
  stylePresetId?: string | null;
  projectId?: string | null;
}): string {
  return sha256Short(
    JSON.stringify({
      prompt: parts.prompt.trim(),
      templateId: parts.templateId ?? "",
      stylePresetId: parts.stylePresetId ?? "",
      projectId: parts.projectId ?? "",
    }),
  );
}

export function rejectBannedRefs(text: string): string | null {
  const lower = text.toLowerCase();
  for (const ref of BANNED_REFS) {
    if (lower.includes(ref)) return `Removed legacy project ref: ${ref}`;
  }
  return null;
}
