/** Strip internal AI planning artifacts from user-visible descriptions. */

const INTERNAL_PATTERNS = [
  /^build execution plan\b/i,
  /^#+\s*build execution plan/i,
  /^execution plan\b/i,
  /^blueprint\b/i,
  /^app plan\b/i,
  /^technical plan\b/i,
  /^generation plan\b/i,
  /^step \d+:/i,
  /^phase \d+:/i,
  /compressed\)$/i,
];

const MAX_LEN = 500;

export type DescriptionInput = {
  prompt?: string | null;
  blueprintSummary?: string | null;
  category?: string | null;
  purpose?: string | null;
  appName?: string | null;
  raw?: string | null;
};

function isInternalPlanningText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 12) return false;
  return INTERNAL_PATTERNS.some((p) => p.test(t));
}

function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? cleaned).slice(0, 240);
}

/** Produce a short, user-facing app description — never internal planning output. */
export function sanitizeUserFacingDescription(input: DescriptionInput): string | null {
  const candidates = [
    input.purpose,
    input.blueprintSummary,
    input.raw,
    input.prompt,
  ].filter((c): c is string => typeof c === "string" && c.trim().length > 0);

  for (const c of candidates) {
    if (isInternalPlanningText(c)) continue;
    const sentence = firstSentence(c);
    if (sentence.length >= 16 && !isInternalPlanningText(sentence)) {
      return sentence.slice(0, MAX_LEN);
    }
  }

  const name = input.appName?.trim() || "Your app";
  const cat = input.category?.trim();
  if (cat) {
    return `${name} — a ${cat.replace(/_/g, " ")} app built on Vodex.`.slice(0, MAX_LEN);
  }
  if (input.prompt && !isInternalPlanningText(input.prompt)) {
    return firstSentence(input.prompt).slice(0, MAX_LEN);
  }
  return `${name} — built with Vodex.`.slice(0, MAX_LEN);
}
