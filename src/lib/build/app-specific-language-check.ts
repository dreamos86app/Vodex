/**
 * Detect generic shell language that should not ship as a finished app.
 */

export const GENERIC_SHELL_PHRASES = [
  /your metrics,\s*workflows,\s*and team tools/i,
  /metrics,\s*workflows,\s*and team tools/i,
  /all in one app/i,
  /welcome to your (?:new )?app/i,
  /this is a (?:simple )?demo/i,
  /placeholder (?:content|page|screen)/i,
  /coming soon/i,
  /lorem ipsum/i,
] as const;

export type AppSpecificLanguageResult = {
  passes: boolean;
  genericHits: string[];
  scorePenalty: number;
};

export function checkAppSpecificLanguage(input: {
  files: Array<{ path: string; content: string }>;
  userPrompt?: string;
}): AppSpecificLanguageResult {
  const uiFiles = input.files.filter((f) => /\.(tsx|jsx)$/i.test(f.path));
  const combined = uiFiles.map((f) => f.content).join("\n");
  const genericHits: string[] = [];

  for (const phrase of GENERIC_SHELL_PHRASES) {
    if (phrase.test(combined)) {
      genericHits.push(phrase.source.slice(0, 48));
    }
  }

  const passes = genericHits.length === 0;
  return {
    passes,
    genericHits,
    scorePenalty: genericHits.length * 12,
  };
}
