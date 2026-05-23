import type { DeployReadinessResult } from "@/lib/deploy/provider-types";
import type { VercelConnectionSnapshot } from "@/lib/deploy/vercel-connection";

export function assessVercelReadiness(
  connection: Pick<VercelConnectionSnapshot, "state" | "hasToken" | "projectLinked">,
): DeployReadinessResult {
  if (connection.state === "not_connected" || !connection.hasToken) {
    return {
      provider: "vercel",
      state: "not_connected",
      blockers: ["Set VERCEL_ACCESS_TOKEN on the server to enable Vercel deploy"],
    };
  }
  if (connection.state === "token_invalid") {
    return {
      provider: "vercel",
      state: "failed",
      blockers: ["Vercel token is invalid — update VERCEL_ACCESS_TOKEN"],
    };
  }
  if (connection.state === "needs_project_link" || !connection.projectLinked) {
    return {
      provider: "vercel",
      state: "blocked",
      blockers: ["Link VERCEL_PROJECT_ID or vercel_project_id in project settings"],
    };
  }
  return { provider: "vercel", state: "ready", blockers: [] };
}
