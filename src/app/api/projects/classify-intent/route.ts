import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyCreateIntent } from "@/lib/intent/create-intent-classifier";
import { requireProjectId, jsonUnauthorized } from "@/lib/ids/required-ids";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized();

  let prompt = "";
  let projectId: string | null = null;
  try {
    const body = (await request.json()) as { prompt?: string; projectId?: string };
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    projectId = requireProjectId(body.projectId);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const result = classifyCreateIntent(prompt, Boolean(projectId));
  return NextResponse.json(result);
}
