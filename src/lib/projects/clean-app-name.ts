/**
 * Canonical app display naming — brandable, short, no sentence fragments.
 */

const WEAK_NAMES =
  /^(new app|new build|my app|untitled|app|application|dream app|async standup app with)$/i;

const TRAILING_FILLER =
  /\s+(with|for|and|the|a|an|to|of|in|on|at|by|from|using|that|this|your|my|our)\s*$/i;

const BAD_FRAGMENTS = [
  /\bapp\s+with\b/i,
  /\bwith\s*$/i,
  /\bapplication\s+for\b/i,
  /\bbuild\s+an?\b/i,
  /\bcreate\s+an?\b/i,
];

const STOP_WORDS = new Set([
  "create",
  "build",
  "make",
  "with",
  "and",
  "the",
  "for",
  "app",
  "application",
  "using",
  "that",
  "this",
  "your",
  "my",
  "our",
  "an",
  "a",
  "to",
  "of",
  "in",
  "on",
]);

export function stripMarkdownNoise(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWord(w: string): string {
  if (!w) return "";
  if (w.length <= 3 && /^[a-z]+$/i.test(w)) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function compoundFromWords(words: string[]): string {
  return words.map(titleCaseWord).join("");
}

function pickBrandableFromPrompt(prompt: string): string {
  const tokens = prompt
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  if (tokens.length === 0) return "FlowDesk";

  const unique = [...new Set(tokens.map((t) => t.toLowerCase()))].slice(0, 3);
  if (unique.length >= 2) {
    const compound = compoundFromWords(unique);
    if (compound.length >= 4 && compound.length <= 24) return compound;
  }

  const single = titleCaseWord(unique[0] ?? "flow");
  const suffixes = ["Desk", "Flow", "Hub", "Pulse", "Board", "Kit"];
  const h = unique.join("").length % suffixes.length;
  const candidate = `${single}${suffixes[h]}`;
  return candidate.slice(0, 24);
}

export function cleanAppName(candidate: string, userPrompt = ""): string {
  let name = stripMarkdownNoise(candidate)
    .replace(/\s+/g, " ")
    .replace(TRAILING_FILLER, "")
    .trim();

  for (const re of BAD_FRAGMENTS) {
    name = name.replace(re, " ").trim();
  }

  name = name.replace(TRAILING_FILLER, "").trim();

  if (!name || WEAK_NAMES.test(name) || name.split(/\s+/).length > 5) {
    name = pickBrandableFromPrompt(userPrompt || candidate);
  }

  if (name.split(/\s+/).length > 3) {
    const words = name.split(/\s+/).filter((w) => !STOP_WORDS.has(w.toLowerCase())).slice(0, 3);
    name = words.length >= 2 ? compoundFromWords(words) : pickBrandableFromPrompt(userPrompt);
  }

  if (name.includes(" ")) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length <= 3 && parts.every((p) => p.length <= 12)) {
      name = compoundFromWords(parts);
    } else {
      name = compoundFromWords(parts.slice(0, 2));
    }
  }

  name = name.replace(/[^a-zA-Z0-9]/g, "").trim();
  if (name.length < 3) name = pickBrandableFromPrompt(userPrompt);
  if (name.length > 24) name = name.slice(0, 24);

  return name || "FlowDesk";
}

export function appNameInitials(displayName: string): string {
  const cleaned = displayName.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  if (cleaned.length >= 2) return cleaned.slice(0, 2).toUpperCase();
  return cleaned.charAt(0).toUpperCase() || "A";
}
