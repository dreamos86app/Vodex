import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildPublishedAuthDiagnostics } from "@/lib/publish/published-auth-diagnostics";

export const dynamic = "force-dynamic";

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
  if (!admin) {
    return NextResponse.json({ ready: false, error: "Service unavailable" }, { status: 503 });
  }

  const [{ data: published }, { data: authRow }] = await Promise.all([
    admin
      .from("published_apps" as never)
      .select("slug, public_url, status")
      .eq("project_id", projectId)
      .eq("status", "published")
      .maybeSingle(),
    admin
      .from("app_auth_provider_settings" as never)
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  const pub = published as { slug?: string; public_url?: string } | null;
  const diagnostics = await buildPublishedAuthDiagnostics({
    projectId,
    slug: pub?.slug ?? null,
    publicUrl: pub?.public_url ?? null,
    authSettings: (authRow as Record<string, unknown> | null) ?? null,
  });

  const blockers = diagnostics.checks.filter((c) => c.status === "error");
  const warnings = diagnostics.checks.filter((c) => c.status === "warn");

  return NextResponse.json({
    ready: diagnostics.ready,
    oauthMode: diagnostics.oauthMode,
    publishedLoginUrl: diagnostics.publishedLoginUrl,
    publishedAppCallbackUrl: diagnostics.publishedAppCallbackUrl,
    supabaseAuthCallbackUrl: diagnostics.supabaseAuthCallbackUrl,
    blockers: blockers.map((c) => ({ id: c.id, detail: c.detail })),
    warnings: warnings.map((c) => ({ id: c.id, detail: c.detail })),
    message: diagnostics.ready
      ? "Auth configuration looks ready. Test sign-in in an incognito window on your published login URL."
      : blockers[0]?.detail ?? "Auth configuration is incomplete.",
  });
}
