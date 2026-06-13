/**
 * Next.js `after()` does not reliably run long background work in local dev / Turbopack.
 * E2E and development use inline fire-and-forget so the build worker actually starts.
 *
 * Production on Vercel must use the dedicated `/build-jobs/[id]/run` route (maxDuration)
 * — `after()` is capped at ~300s and kills builds mid-pipeline.
 */
export function shouldRunInlineAsyncBuild(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.E2E_RUN_LIVE === "1" ||
    process.env.DREAMOS_INLINE_ASYNC_BUILD === "1"
  );
}

export { shouldUseLongRunningBuildRoute } from "@/lib/build/kick-staged-build-worker";
