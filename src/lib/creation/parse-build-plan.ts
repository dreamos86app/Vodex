import { stripFencedCodeForChat } from "@/lib/creation/extract-fenced-code";
import { stripMarkdownNoise } from "@/lib/projects/project-context";

const DEFAULT_TASK_LABELS = [
  "Planning",
  "Creating identity",
  "Designing screens",
  "Creating data model",
  "Wiring actions",
  "Preparing preview",
  "Final polish",
] as const;

/** Phase headers from assistant `## [phase]` blocks (build mode). */
export function extractPhaseLabels(text: string): string[] {
  const labels: string[] = [];
  const re = /##\s*\[([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]?.trim();
    if (raw) labels.push(raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, " "));
  }
  return labels;
}

/** First line after `## [planning]` — treated as working title / summary. */
export function extractPlanningSummary(text: string): string | null {
  const m = text.match(/##\s*\[planning\][^\n]*\n+([^\n#][^\n]{0,240})/i);
  const line = m?.[1]?.trim();
  return line || null;
}

/** Short architecture blurb: first `## [architecture]` paragraph. */
export function extractArchitectureSummary(text: string): string | null {
  const m = text.match(/##\s*\[architecture\][^\n]*\n+([^\n#][^\n]{0,280})/i);
  return m?.[1]?.trim() ?? null;
}

/** Inferred icon concept from a loose label line if model emits one. */
export function extractIconConcept(text: string): string | null {
  const m = text.match(
    /(?:icon|logo|mark)\s*(?:concept|:)?\s*[—:-]?\s*([^\n.]{3,120})/i,
  );
  return m?.[1]?.trim() ?? null;
}

export type BuildPlanCard = {
  /** User-facing planning line */
  summary: string | null;
  architecture: string | null;
  iconConcept: string | null;
  phases: string[];
  taskLabels: string[];
};

function cleanPlanLine(line: string | null): string | null {
  if (!line) return null;
  const cleaned = stripMarkdownNoise(line);
  return cleaned || null;
}

export function parseBuildPlanCard(rawAssistantText: string): BuildPlanCard {
  const text = stripFencedCodeForChat(rawAssistantText);
  const phases = extractPhaseLabels(rawAssistantText).map((p) => stripMarkdownNoise(p));
  const summary = cleanPlanLine(extractPlanningSummary(rawAssistantText));
  const architecture = cleanPlanLine(extractArchitectureSummary(rawAssistantText));
  const iconConcept = cleanPlanLine(extractIconConcept(text));
  const taskLabels =
    phases.length >= 3 ? phases : [...DEFAULT_TASK_LABELS];
  return {
    summary,
    architecture,
    iconConcept,
    phases,
    taskLabels,
  };
}

/** Map stream progress length to a stable task index (no fake percentages). */
export function taskProgressIndex(textLength: number, taskCount: number): number {
  if (taskCount <= 0) return 0;
  const t = Math.floor(textLength / 380);
  return Math.min(taskCount - 1, Math.max(0, t));
}
