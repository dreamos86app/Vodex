import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { slugifyAppName, isReservedPublishSlug, validateCustomSlug } from "@/lib/publish/app-slug";
import { findUniquePublishSlug, isSlugAvailable } from "@/lib/publish/publish-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim() ?? "";
  const projectId = url.searchParams.get("projectId")?.trim();
  const base = slugifyAppName(name || "app");

  if (isReservedPublishSlug(base)) {
    return NextResponse.json({ ok: false, slug: base, reserved: true });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const unique = await findUniquePublishSlug(writer, name || "app", projectId || undefined);
  return NextResponse.json({ ok: Boolean(unique), slug: unique ?? base, reserved: false });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { slug?: string; projectId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.slug?.trim() ?? "";
  const v = validateCustomSlug(raw);
  if (!v.ok) {
    return NextResponse.json({
      ok: false,
      slug: v.slug,
      reserved: v.error === "reserved_slug",
      error: v.error,
    });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const available = await isSlugAvailable(writer, v.slug, body.projectId?.trim());
  return NextResponse.json({
    ok: available,
    slug: v.slug,
    reserved: false,
    taken: !available,
  });
}
