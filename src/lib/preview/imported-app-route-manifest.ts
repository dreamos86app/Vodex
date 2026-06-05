import type { BuildFile } from "@/lib/build/generated-file-utils";
import { discoverImportedAppRoutes, routePathsFromDiscovery } from "@/lib/preview/route-discovery";

export type ImportedRouteManifest = {
  routes: ReturnType<typeof discoverImportedAppRoutes>;
  paths: string[];
  discoveredAt: string;
  source: "zip_import" | "preview_build" | "publish";
};

export function buildImportedRouteManifest(
  files: BuildFile[],
  source: ImportedRouteManifest["source"] = "zip_import",
): ImportedRouteManifest {
  const routes = discoverImportedAppRoutes(files);
  return {
    routes,
    paths: routePathsFromDiscovery(files),
    discoveredAt: new Date().toISOString(),
    source,
  };
}

export function mergeRouteManifestIntoMetadata(
  metadata: Record<string, unknown>,
  manifest: ImportedRouteManifest,
): Record<string, unknown> {
  return {
    ...metadata,
    discovered_routes: manifest.paths,
    blueprint_routes: manifest.paths,
    route_manifest: manifest,
  };
}
