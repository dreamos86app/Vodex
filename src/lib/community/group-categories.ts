export const GROUP_CATEGORIES = [
  "General",
  "SaaS",
  "Mobile",
  "Backend",
  "Frontend",
  "AI",
  "Open Source",
  "Indie",
  "Design",
  "Web3",
  "Other",
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

export function normalizeGroupCategories(input: string[]): string[] {
  const allowed = new Set<string>(GROUP_CATEGORIES);
  const picked = input
    .map((c) => c.trim())
    .filter((c) => allowed.has(c));
  return picked.length ? [...new Set(picked)] : ["General"];
}
