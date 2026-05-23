import { compressProjectContext, type CompressibleFile } from "@/lib/ai/prompt-compressor";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";

export function buildProjectContextPack(input: {
  blueprint: AppBlueprint;
  files: CompressibleFile[];
  changedPaths?: string[];
}): string {
  const changed = new Set(input.changedPaths ?? []);
  const compressed = compressProjectContext(input.files, changed);

  return JSON.stringify(
    {
      blueprint: {
        appName: input.blueprint.appName,
        appType: input.blueprint.appType,
        pages: input.blueprint.pages,
        complexity: input.blueprint.complexity,
        authRequired: input.blueprint.authRequired,
        integrations: input.blueprint.integrations,
      },
      files: compressed.files,
      summary: compressed.summary,
    },
    null,
    0,
  );
}
