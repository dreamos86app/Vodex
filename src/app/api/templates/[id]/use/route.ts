import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { getServerSessionUser } from "@/lib/auth/session";
import { duplicateTemplateToProject } from "@/lib/templates/duplicate-template-to-project";
import { duplicateCommunityTemplateToProject } from "@/lib/templates/duplicate-community-template";
import { getTemplateById } from "@/lib/templates/template-catalog";
import { isOfficialTemplateId } from "@/lib/templates/official-templates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const isCatalog =
    isOfficialTemplateId(templateId) || Boolean(getTemplateById(templateId));

  const result = isCatalog
    ? await duplicateTemplateToProject({ supabase, userId: user.id, templateId })
    : UUID_RE.test(templateId)
      ? await duplicateCommunityTemplateToProject({
          supabase,
          userId: user.id,
          templateId,
        })
      : { ok: false as const, error: "Unknown template", code: "template_not_found" };

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
