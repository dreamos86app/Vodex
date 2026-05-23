export type PreviewProviderLevel =
  | "in_app_sandbox"
  | "static_snapshot"
  | "vercel_preview"
  | "external_hosted";

export type PreviewProviderResult = {
  level: PreviewProviderLevel;
  /** Real URL from provider — empty until session URL is assigned (in-app) or Vercel responds. */
  previewUrl: string;
  external: boolean;
  externalUrl?: string | null;
  logs: string[];
  error?: string;
  deploymentId?: string | null;
};

export type PreviewProviderContext = {
  projectId: string;
  userId: string;
  sessionId: string;
  files: Array<{ path: string; content: string }>;
  vercelToken?: string | null;
  vercelProjectId?: string | null;
  projectMeta?: Record<string, unknown>;
};

export type PreviewProvider = {
  id: PreviewProviderLevel;
  label: string;
  canAttempt(ctx: PreviewProviderContext): boolean;
  attempt(ctx: PreviewProviderContext): Promise<PreviewProviderResult>;
};

export const PREVIEW_LEVEL_LABELS: Record<PreviewProviderLevel, string> = {
  in_app_sandbox: "In-app sandbox",
  static_snapshot: "Static snapshot",
  vercel_preview: "Vercel preview",
  external_hosted: "Hosted preview",
};
