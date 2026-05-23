import type { DeployReadinessResult } from "@/lib/deploy/provider-types";

export function assessGithubReadiness(repoConnected: boolean): DeployReadinessResult {
  if (!repoConnected) {
    return {
      provider: "github",
      state: "needs_auth",
      blockers: ["Connect a GitHub repository"],
    };
  }
  return { provider: "github", state: "ready", blockers: [] };
}
