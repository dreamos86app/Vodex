import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveVercelConnection } from "@/lib/deploy/vercel-connection";

/** Global Vercel connection snapshot (token validated against Vercel API). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await resolveVercelConnection(undefined, { validateToken: true });

  return NextResponse.json({
    state: snapshot.state,
    hasToken: snapshot.hasToken,
    tokenValid: snapshot.tokenValid,
    teamConfigured: snapshot.teamConfigured,
    projectLinked: snapshot.projectLinked,
    projectId: snapshot.projectId,
    teamId: snapshot.teamId,
    envSyncOk: snapshot.envSyncOk,
    missingEnv: snapshot.missingEnv,
    message: snapshot.message,
  });
}
