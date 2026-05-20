import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PreviewError = {
  message: string;
  file?: string;
  line?: number;
  column?: number;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const builder = meta.builder as Record<string, unknown> | undefined;
  const preview = builder?.preview as Record<string, unknown> | undefined;
  const rawErrors = preview?.errors;

  const errors: PreviewError[] = Array.isArray(rawErrors)
    ? rawErrors
        .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
        .map((e) => ({
          message: String(e.message ?? e.detail ?? "Unknown error"),
          file: typeof e.file === "string" ? e.file : typeof e.path === "string" ? e.path : undefined,
          line: typeof e.line === "number" ? e.line : undefined,
          column: typeof e.column === "number" ? e.column : undefined,
        }))
    : [];

  const { data: buildJob } = await supabase
    .from("build_jobs")
    .select("status, error_message, result_summary")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    errors,
    buildStatus: buildJob?.status ?? null,
    buildError: buildJob?.error_message ?? null,
    updatedAt: new Date().toISOString(),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { errors?: PreviewError[] };
  try {
    body = (await req.json()) as { errors?: PreviewError[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? { ...(project.metadata as Record<string, unknown>) }
      : {};

  const builder = (meta.builder as Record<string, unknown> | undefined) ?? {};
  const preview = (builder.preview as Record<string, unknown> | undefined) ?? {};
  preview.errors = body.errors ?? [];
  preview.updated_at = new Date().toISOString();
  builder.preview = preview;
  meta.builder = builder;

  const { error } = await supabase
    .from("projects")
    .update({ metadata: meta as never })
    .eq("id", projectId)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: (body.errors ?? []).length });
}
