import { assessGithubReadiness } from "@/lib/deploy/github-readiness";
import { assessVercelReadiness } from "@/lib/deploy/vercel-readiness";
import type { DeployReadinessResult } from "@/lib/deploy/provider-types";
import type { VercelConnectionSnapshot } from "@/lib/deploy/vercel-connection";

export function getDeployProviderStatuses(input: {
  githubConnected: boolean;
  vercel: Pick<VercelConnectionSnapshot, "state" | "hasToken" | "projectLinked">;
}): DeployReadinessResult[] {
  return [
    {
      provider: "export",
      state: "ready",
      blockers: [],
    },
    assessGithubReadiness(input.githubConnected),
    assessVercelReadiness(input.vercel),
  ];
}
