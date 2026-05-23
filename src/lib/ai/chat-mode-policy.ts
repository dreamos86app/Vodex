export type ChatMode = "discuss" | "edit" | "build";

export type ChatModePolicy = {
  mode: ChatMode;
  canBuildApps: boolean;
  canEditFiles: boolean;
  canPublishApps: boolean;
  canChargeCredits: boolean;
  redirectHint: string;
};

const POLICIES: Record<ChatMode, ChatModePolicy> = {
  discuss: {
    mode: "discuss",
    canBuildApps: false,
    canEditFiles: false,
    canPublishApps: false,
    canChargeCredits: true,
    redirectHint: "Open Create (/create) to start a build, or Builder to edit an existing app.",
  },
  edit: {
    mode: "edit",
    canBuildApps: false,
    canEditFiles: true,
    canPublishApps: false,
    canChargeCredits: true,
    redirectHint: "Edits create a pending diff — accept in Builder to apply.",
  },
  build: {
    mode: "build",
    canBuildApps: true,
    canEditFiles: true,
    canPublishApps: false,
    canChargeCredits: true,
    redirectHint: "Publish from the app dashboard or preview when ready.",
  },
};

export function getChatModePolicy(mode: ChatMode): ChatModePolicy {
  return POLICIES[mode];
}

export function discussModeLimitReply(intent: "build" | "edit" | "publish"): string {
  const base = "I'm in Discuss mode — I can explain and guide, but I can't directly change your app here.";
  if (intent === "build") {
    return `${base} Open **Create** to describe your app and start the build flow.`;
  }
  if (intent === "edit") {
    return `${base} Open your app in **Builder** to propose and accept edits.`;
  }
  return `${base} Open your generated app and use the **Publish** flow when preview is ready.`;
}
