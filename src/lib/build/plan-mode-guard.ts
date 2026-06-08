/**
 * P1.3.18 — Plan-first mode must never run the build pipeline.
 */
export function isPlanFirstOnlyRequest(input: {
  planFirstOnly?: boolean;
  strategy?: "plan_first" | "build_now";
  forceBuildPipeline?: boolean;
  blueprintApproved?: boolean;
}): boolean {
  if (input.forceBuildPipeline === true) return false;
  if (input.planFirstOnly === true) return true;
  if (input.strategy === "plan_first" && input.blueprintApproved !== true) return true;
  return false;
}

export function shouldBlockBuildPipelineForPlan(input: {
  planFirstOnly?: boolean;
  strategy?: "plan_first" | "build_now";
  forceBuildPipeline?: boolean;
  blueprintApproved?: boolean;
}): boolean {
  return isPlanFirstOnlyRequest(input);
}
