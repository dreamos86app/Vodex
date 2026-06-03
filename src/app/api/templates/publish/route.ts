import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isPaidPlan } from "@/lib/billing/plan-features";
import { publishProjectAsTemplate } from "@/lib/templates/template-publish";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(2000),
  category: z.string().min(2).max(64),
  tags: z.array(z.string().min(1).max(32)).max(12).default([]),
  previewImageUrl: z.string().url().nullable().optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
});

export async function POST(req: Request) {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!isPaidPlan(profile?.plan_id)) {
    return NextResponse.json(
      { error: "Publishing community templates requires a Pro plan or higher." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await publishProjectAsTemplate({
    supabase,
    userId: user.id,
    input: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      tags: parsed.data.tags,
      previewImageUrl: parsed.data.previewImageUrl ?? null,
      visibility: parsed.data.visibility,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, templateId: result.templateId });
}
