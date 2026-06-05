import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadPublishedAppBySlug } from "@/lib/publish/published-app-runtime";
import { syncAppUserProfile } from "@/lib/publish/app-user-profile-sync";
import { recordPublishedAuthError } from "@/lib/publish/published-auth-diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug?.trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const published = await loadPublishedAppBySlug(slug);
  if (!published) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { eventType?: string; provider?: string | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const eventType =
    body.eventType === "signup_success" ? "signup_success" : ("login_success" as const);

  const result = await syncAppUserProfile({
    projectId: published.project_id,
    ownerId: published.owner_id,
    publishedAppId: published.id,
    slug,
    user: data.user,
    provider: body.provider,
    eventType,
  });

  if (!result.ok) {
    await recordPublishedAuthError(published.project_id, result.error ?? "profile_sync_failed");
    return NextResponse.json({ ok: false, synced: false, error: result.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true, synced: true, userId: data.user.id });
}
