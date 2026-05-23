import type {
  PreviewProvider,
  PreviewProviderContext,
  PreviewProviderLevel,
  PreviewProviderResult,
} from "@/lib/preview/preview-provider-types";
import { buildStaticPreviewHtml } from "@/lib/preview/static-preview-builder";
import { attemptVercelPreview } from "@/lib/preview/vercel-preview-provider";

const inAppSandbox: PreviewProvider = {
  id: "in_app_sandbox",
  label: "In-app sandbox",
  canAttempt: () => true,
  async attempt(ctx): Promise<PreviewProviderResult> {
    return {
      level: "in_app_sandbox",
      previewUrl: "",
      external: false,
      logs: ["In-app sandbox — session URL assigned after snapshot validation."],
    };
  },
};

const staticSnapshot: PreviewProvider = {
  id: "static_snapshot",
  label: "Static snapshot",
  canAttempt: (ctx) => ctx.files.some((f) => f.path.endsWith(".html") || /\.(tsx|jsx)$/i.test(f.path)),
  async attempt(ctx): Promise<PreviewProviderResult> {
    buildStaticPreviewHtml(ctx.files);
    return {
      level: "static_snapshot",
      previewUrl: "",
      external: false,
      logs: ["Built static HTML snapshot for iframe preview."],
    };
  },
};

const vercelPreview: PreviewProvider = {
  id: "vercel_preview",
  label: "Vercel preview",
  canAttempt: (ctx) => Boolean(ctx.vercelToken),
  attempt: attemptVercelPreview,
};

/** Future: third-party hosted runtimes (Fly, Railway, etc.) — must return real provider URLs only. */
const externalHostedFuture: PreviewProvider = {
  id: "external_hosted",
  label: "External hosted",
  canAttempt: () => false,
  async attempt(): Promise<PreviewProviderResult> {
    return {
      level: "external_hosted",
      previewUrl: "",
      external: true,
      logs: ["External hosted provider not configured."],
      error: "not_configured",
    };
  },
};

export const PREVIEW_PROVIDERS: PreviewProvider[] = [
  inAppSandbox,
  staticSnapshot,
  vercelPreview,
  externalHostedFuture,
];

export const PREVIEW_PROVIDER_CHAIN: PreviewProviderLevel[] = [
  "vercel_preview",
  "static_snapshot",
  "in_app_sandbox",
];

/** Resolve best available preview provider — never fabricates external URLs. */
export async function resolvePreviewProvider(ctx: PreviewProviderContext): Promise<PreviewProviderResult> {
  const logs: string[] = [];

  if (!ctx.vercelToken) {
    logs.push("Vercel not connected — using in-app static snapshot preview.");
  } else if (!ctx.vercelProjectId) {
    logs.push("Vercel token present but project not linked — using in-app static snapshot preview.");
  } else {
    const vercel = await vercelPreview.attempt(ctx);
    logs.push(...vercel.logs);
    if (vercel.externalUrl && !vercel.error) {
      return { ...vercel, logs };
    }
    if (vercel.error && vercel.error !== "url_pending") {
      logs.push(`Vercel unavailable (${vercel.error}) — falling back to static snapshot.`);
    } else if (vercel.error === "url_pending") {
      logs.push("Vercel URL pending — falling back to static snapshot until hosted URL is ready.");
    }
  }

  if (staticSnapshot.canAttempt(ctx)) {
    const staticResult = await staticSnapshot.attempt(ctx);
    return { ...staticResult, logs: [...logs, ...staticResult.logs] };
  }

  const sandbox = await inAppSandbox.attempt(ctx);
  return { ...sandbox, logs: [...logs, ...sandbox.logs] };
}

export function previewLevelHonest(level: PreviewProviderLevel): boolean {
  return level === "in_app_sandbox" || level === "static_snapshot";
}

export function previewProviderNotConnected(ctx: PreviewProviderContext): boolean {
  return !ctx.vercelToken;
}

export function previewProviderLabel(level: PreviewProviderLevel, vercelConnected: boolean): string {
  if (level === "external_hosted") return "Hosted preview (Vercel)";
  if (level === "vercel_preview" && !vercelConnected) return "Vercel not connected";
  if (level === "static_snapshot") return "Static snapshot (in-app)";
  if (level === "in_app_sandbox") return "In-app sandbox";
  return level;
}
