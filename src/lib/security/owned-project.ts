import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

type Writer = SupabaseClient<Database>;

export type OwnedProjectResult = { ok: true } | NextResponse;

export function isOwnedProjectFailure(result: OwnedProjectResult): result is NextResponse {
  return result instanceof NextResponse;
}

export async function requireOwnedProject(
  writer: Writer,
  projectId: string,
  userId: string,
): Promise<OwnedProjectResult> {
  const { data } = await writer
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data?.id) {
    return NextResponse.json({ error: "Project not found", code: "not_found" }, { status: 404 });
  }
  return { ok: true };
}
