import type { BuildFile } from "@/lib/build/generated-file-utils";
import { discoverImportedAppRoutes } from "@/lib/preview/route-discovery";

export type PreviewRouteEntry = {
  path: string;
  label: string;
  source: string;
};

export function detectPreviewRoutesFromFiles(files: BuildFile[]): PreviewRouteEntry[] {
  return discoverImportedAppRoutes(files);
}
