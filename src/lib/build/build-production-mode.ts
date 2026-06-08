/** Production vs smoke/test build modes. */
export function isSmokeBuildMode(): boolean {
  return process.env.DREAMOS_SMOKE_BUILD === "1";
}

export function isProductionBuildMode(): boolean {
  return !isSmokeBuildMode();
}
