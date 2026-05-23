const EDIT_PATTERNS = [
  /\b(change|fix|update|edit|modify|adjust|improve|redesign|refactor)\b/i,
  /\b(make this|make the|add a button|add button|remove the)\b/i,
  /\b(mobile|responsive|spacing|padding|margin|color|font)\b/i,
  /\b(header|footer|sidebar|nav|page|screen|component)\b/i,
];

export function detectEditIntent(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return false;
  return EDIT_PATTERNS.some((p) => p.test(t));
}
