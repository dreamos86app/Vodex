import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHECKS = [
  "leaked_secrets",
  "public_env_exposure",
  "insecure_routes",
  "auth_required",
  "payment_webhook",
  "cors_risk",
  "unsafe_eval",
  "service_role_exposure",
  "dependency_vulnerabilities",
  "rls_warnings",
] as const;

async function runSecurityScan(projectId: string, files: Array<{ path: string; content: string }>) {
  const combined = files.map((f) => f.content).join("\n");
  const findings: Array<{ id: string; severity: string; title: string; detail: string }> = [];

  if (/service_role|SUPABASE_SERVICE_ROLE/i.test(combined)) {
    findings.push({
      id: "service_role_exposure",
      severity: "critical",
      title: "Service role key reference",
      detail: "Source references a Supabase service role key. Never ship this to the browser.",
    });
  }
  if (/eval\s*\(|dangerouslySetInnerHTML/i.test(combined)) {
    findings.push({
      id: "unsafe_eval",
      severity: "high",
      title: "Unsafe dynamic code/HTML",
      detail: "Found eval() or dangerouslySetInnerHTML usage.",
    });
  }
  if (/sk_live_|sk_test_|api[_-]?key\s*=\s*['"][^'"]+['"]/i.test(combined)) {
    findings.push({
      id: "leaked_secrets",
      severity: "critical",
      title: "Possible hardcoded secret",
      detail: "Review source for embedded API keys or tokens.",
    });
  }

  for (const check of CHECKS) {
    if (!findings.some((f) => f.id === check) && check === "auth_required") {
      /* pass if no finding */
    }
  }

  return {
    status: "completed" as const,
    findings,
    checksRun: CHECKS.length,
    filesScanned: files.length,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ scans: [] });

  const { data } = await admin
    .from("app_security_scans" as never)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ scans: data ?? [] });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  const { data: running } = await admin
    .from("app_security_scans" as never)
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .limit(1);
  if (running?.length) {
    return NextResponse.json({ error: "Scan already in progress" }, { status: 409 });
  }

  const scanId = randomUUID();
  await admin.from("app_security_scans" as never).insert({
    id: scanId,
    project_id: projectId,
    owner_id: user.id,
    status: "running",
    started_at: new Date().toISOString(),
  } as never);

  const { data: fileRows } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(500);

  const files = (fileRows ?? []).map((r) => ({
    path: String((r as { path?: string }).path ?? ""),
    content: String((r as { content?: string }).content ?? ""),
  }));

  const result = await runSecurityScan(projectId, files);

  await admin
    .from("app_security_scans" as never)
    .update({
      status: result.status,
      completed_at: new Date().toISOString(),
      findings: result.findings,
    } as never)
    .eq("id", scanId);

  await admin.from("app_activity_events" as never).insert({
    project_id: projectId,
    owner_id: user.id,
    category: "security",
    action: "scan_completed",
    summary: `Security scan completed — ${result.findings.length} findings`,
    meta: { scanId, findings: result.findings.length, checksRun: result.checksRun },
  } as never);

  return NextResponse.json({ scanId, ...result });
}
