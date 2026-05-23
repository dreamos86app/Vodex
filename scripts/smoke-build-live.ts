process.env.NODE_USE_SYSTEM_CA = process.env.NODE_USE_SYSTEM_CA ?? "1";

/**
 * Live benchmark smoke build — runs staged pipeline for one project (honest LLM generation).
 * Usage: npx tsx scripts/smoke-build-live.ts <projectId> <prompt> [appType]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { runStagedBuildPipeline } from "../src/lib/build/build-pipeline";
import { finalizeBuildSuccess, finalizeBuildFailed } from "../src/lib/build/finalize-build";
import { buildAppBlueprint } from "../src/lib/build/app-blueprint";
import { formatBlueprintForBuild } from "../src/lib/build/format-blueprint-prompt";
import { readCreateFlowConfig } from "../src/lib/create/create-flow-config";
import { lifecyclePatch } from "../src/lib/projects/project-lifecycle";
import type { Database } from "../src/lib/supabase/types";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
for (const [k, v] of Object.entries(env)) {
  if (v != null && v !== "") process.env[k] = v;
}
process.env.NODE_USE_SYSTEM_CA = process.env.NODE_USE_SYSTEM_CA ?? "1";
process.env.DREAMOS_SMOKE_BUILD = "1";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
const projectId = process.argv[2];
const userPrompt = process.argv[3] ?? "";
const appType = process.argv[4] ?? null;

if (!url || !serviceKey || !projectId || !userPrompt) {
  console.error("Usage: npx tsx scripts/smoke-build-live.ts <projectId> <prompt> [appType]");
  process.exit(1);
}

const writer = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: project, error } = await writer
    .from("projects")
    .select("id, owner_id, metadata, name")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project?.owner_id) {
    console.error(JSON.stringify({ ok: false, error: error?.message ?? "project not found" }));
    process.exit(1);
  }

  const userId = project.owner_id;
  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const cfg = readCreateFlowConfig(meta);
  const blueprintResult = await buildAppBlueprint({
    prompt: userPrompt,
    projectId,
    templateId: cfg.templateId,
    stylePresetId: cfg.stylePresetId ?? "minimal",
    qualityLevel: "standard",
    mode: "deterministic_quick",
  });

  if (!blueprintResult.blueprint) {
    console.error(JSON.stringify({ ok: false, error: "blueprint failed" }));
    process.exit(1);
  }

  const blueprint = blueprintResult.blueprint;
  await writer
    .from("projects")
    .update({
      metadata: {
        ...meta,
        ...lifecyclePatch("blueprint_ready", {
          approved_blueprint: blueprint,
          blueprint_approved: true,
          app_type: appType ?? blueprint.appType,
          blueprint_routes: blueprint.routeMap?.map((r) => (typeof r === "string" ? r : r.route)),
        }),
      },
    } as never)
    .eq("id", projectId);

  const now = new Date().toISOString();
  let job: { id: string } | null = null;
  let jobErr: { message: string } | null = null;

  ({ data: job, error: jobErr } = await writer
    .from("build_jobs")
    .insert({
      project_id: projectId,
      user_id: userId,
      status: "running",
      started_at: now,
      prompt: userPrompt.slice(0, 2000),
      meta: { source: "smoke-benchmark" },
    } as never)
    .select("id")
    .single());

  if (jobErr?.message?.includes("prompt") || jobErr?.message?.includes("user_id") || jobErr?.message?.includes("meta")) {
    ({ data: job, error: jobErr } = await writer
      .from("build_jobs")
      .insert({
        project_id: projectId,
        owner_id: userId,
        status: "running",
        started_at: now,
        metadata: { prompt: userPrompt.slice(0, 2000), source: "smoke-benchmark" },
      } as never)
      .select("id")
      .single());
  }

  if (jobErr || !job?.id) {
    console.error(JSON.stringify({ ok: false, error: jobErr?.message ?? "build job failed" }));
    process.exit(1);
  }

  const blueprintBlock = formatBlueprintForBuild(blueprint, {
    stylePresetId: cfg.stylePresetId,
    templateId: cfg.templateId,
    buildTier: cfg.buildTier,
    appType: appType ?? blueprint.appType,
  });

  const operationId = `smoke-${projectId.slice(0, 8)}-${Date.now()}`;
  const result = await runStagedBuildPipeline({
    writer,
    userId,
    userEmail: null,
    operationId,
    projectId,
    buildJobId: job.id,
    userPrompt,
    blueprintBlock,
  });

  if (!result.ok || result.files.length === 0) {
    await finalizeBuildFailed({
      writer,
      buildJobId: job.id,
      errorMessage: result.errorMessage ?? "staged build produced no files",
      projectId,
      userId,
    });
    console.error(JSON.stringify({ ok: false, error: result.errorMessage ?? "no files", uiScore: 0 }));
    process.exit(1);
  }

  const rows = result.files.map((f) => ({
    project_id: projectId,
    owner_id: userId,
    path: f.path,
    content: f.content,
    language: f.language ?? null,
  }));
  const { error: filesErr } = await writer.from("app_files").upsert(rows as never, { onConflict: "project_id,path" });
  if (filesErr?.message?.includes("owner_id")) {
    await writer.from("app_files").upsert(
      result.files.map((f) => ({
        project_id: projectId,
        path: f.path,
        content: f.content,
        language: f.language ?? null,
      })) as never,
      { onConflict: "project_id,path" },
    );
  } else if (filesErr) {
    console.error(JSON.stringify({ ok: false, error: filesErr.message }));
    process.exit(1);
  }

  await finalizeBuildSuccess({
    writer,
    userId,
    projectId,
    buildJobId: job.id,
    appName: result.meta?.app?.name ?? project.name ?? "App",
    appSlug: result.meta?.app?.slug ?? null,
    appDescription: result.meta?.app?.description ?? null,
    iconSvg: result.iconSvg,
    meta: result.meta,
    fileCount: result.files.length,
    creditsCharged: 0,
    charged: false,
  });

  console.log(
    JSON.stringify({
      ok: true,
      projectId,
      fileCount: result.files.length,
      providerCostUsd: result.totalProviderCostUsd,
    }),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
