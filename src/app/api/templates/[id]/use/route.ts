import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { getServerSessionUser } from "@/lib/auth/session";
import { duplicateTemplateToProject } from "@/lib/templates/duplicate-template-to-project";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const templateId = id?.trim();
  if (!templateId) {
    return NextResponse.json({ error: "Template id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await duplicateTemplateToProject({
    supabase,
    userId: user.id,
    templateId,
  });

  if (!result.ok) {
    const status = result.code === "template_not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    projectId: result.projectId,
    slug: result.slug,
    templateName: result.templateName,
    fileCount: result.fileCount,
    builderUrl: `/apps/${result.projectId}/builder`,
  });
}
