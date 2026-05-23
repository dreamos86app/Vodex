import {
  createVercelDeployment,
  fetchVercelDeploymentStatus,
} from "@/lib/deploy/vercel-client";
import { getVercelServerConfig } from "@/lib/deploy/vercel-config";
import type { PreviewProviderContext, PreviewProviderResult } from "@/lib/preview/preview-provider-types";

const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll Vercel until deployment URL is ready — only returns provider-supplied URLs. */
export async function pollVercelPreviewUrl(input: {
  deploymentId: string;
  projectMeta?: Record<string, unknown>;
}): Promise<{ url: string | null; state: string; logs: string[] }> {
  const logs: string[] = [];
  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    const status = await fetchVercelDeploymentStatus(input);
    logs.push(`Vercel poll ${i + 1}/${POLL_ATTEMPTS}: ${status.state}`);
    if (status.url) {
      return { url: `https://${status.url.replace(/^https?:\/\//, "")}`, state: status.state, logs };
    }
    if (status.state === "ERROR" || status.state === "CANCELED") {
      return { url: null, state: status.state, logs };
    }
    if (i < POLL_ATTEMPTS - 1) await sleep(POLL_DELAY_MS);
  }
  return { url: null, state: "url_pending", logs };
}

/** Vercel hosted preview — only returns URL from real deploy response. */
export async function attemptVercelPreview(ctx: PreviewProviderContext): Promise<PreviewProviderResult> {
  const cfg = getVercelServerConfig(ctx.projectMeta);
  if (!cfg.hasToken) {
    return {
      level: "vercel_preview",
      previewUrl: "",
      external: true,
      logs: ["Vercel not connected — set VERCEL_ACCESS_TOKEN to enable hosted preview."],
      error: "not_connected",
    };
  }
  if (cfg.state === "needs_project_link") {
    return {
      level: "vercel_preview",
      previewUrl: "",
      external: true,
      logs: ["Vercel token present — link VERCEL_PROJECT_ID or project metadata for hosted preview."],
      error: "needs_project_link",
    };
  }

  const deploy = await createVercelDeployment({
    name: `dreamos-preview-${ctx.projectId.slice(0, 8)}`,
    files: ctx.files.slice(0, 80).map((f) => ({ path: f.path, content: f.content })),
    projectMeta: ctx.projectMeta,
  });

  if (!deploy.ok) {
    return {
      level: "vercel_preview",
      previewUrl: "",
      external: true,
      logs: [`Vercel deploy failed: ${deploy.error}`],
      error: deploy.code,
    };
  }

  let externalUrl = deploy.url ? `https://${deploy.url.replace(/^https?:\/\//, "")}` : null;
  const logs = [`Deployment ${deploy.deploymentId} started (state: ${deploy.state})`];

  if (!externalUrl && deploy.deploymentId) {
    const polled = await pollVercelPreviewUrl({
      deploymentId: deploy.deploymentId,
      projectMeta: ctx.projectMeta,
    });
    logs.push(...polled.logs);
    externalUrl = polled.url;
    if (!externalUrl) {
      return {
        level: "vercel_preview",
        previewUrl: "",
        external: true,
        deploymentId: deploy.deploymentId,
        logs: [...logs, "Vercel URL not ready — falling back to in-app snapshot."],
        error: "url_pending",
      };
    }
  }

  if (!externalUrl) {
    return {
      level: "vercel_preview",
      previewUrl: "",
      external: true,
      deploymentId: deploy.deploymentId,
      logs: [...logs, "No URL returned by Vercel."],
      error: "url_pending",
    };
  }

  return {
    level: "external_hosted",
    previewUrl: externalUrl,
    external: true,
    externalUrl,
    deploymentId: deploy.deploymentId,
    logs: [...logs, `Vercel deployment ready: ${externalUrl}`],
  };
}
