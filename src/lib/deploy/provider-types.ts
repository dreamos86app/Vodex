export type DeployProviderId = "export" | "github" | "vercel" | "netlify";

export type DeployProviderState =
  | "not_connected"
  | "needs_auth"
  | "ready"
  | "blocked"
  | "deploying"
  | "deployed"
  | "failed";

export type DeployReadinessResult = {
  provider: DeployProviderId;
  state: DeployProviderState;
  blockers: string[];
  deploymentUrl?: string | null;
};
