import { NextResponse } from "next/server";
import { verifyProjectOwner } from "@/lib/integrations/server/verify-project";
import { githubOAuthConfigured } from "@/lib/integrations/server/github-api";
import {
  getUserProviderAccessToken,
} from "@/lib/integrations/server/user-provider-connections";
import {
  saveProjectSecret,
  upsertProjectIntegration,
  writeConnectionAudit,
} from "@/lib/integrations/server/integration-store";
import { testGitHubConnection } from "@/lib/integrations/server/github-api";
import { isPaidPlan } from "@/lib/billing/plan-features";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST — one-click GitHub using linked Vodex account. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const verified = await verifyProjectOwner(projectId);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", verified.data.ownerId)
    .maybeSingle();

  if (!isPaidPlan(profile?.plan_id)) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const token = await getUserProviderAccessToken(verified.data.ownerId, "github");
  if (!token) {
    if (!githubOAuthConfigured()) {
      return NextResponse.json({ error: "GitHub OAuth not configured" }, { status: 503 });
    }
    return NextResponse.json(
      { needsOAuth: true, oauthUrl: `/api/projects/${projectId}/integrations/github/oauth/start` },
      { status: 409 },
    );
  }

  const test = await testGitHubConnection(token);
  if (!test.ok) {
    return NextResponse.json({ error: test.error ?? "GitHub test failed" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await saveProjectSecret({
    projectId,
    ownerId: verified.data.ownerId,
    provider: "github",
    keyName: "GITHUB_TOKEN",
    value: token,
  });
  await upsertProjectIntegration({
    projectId,
    ownerId: verified.data.ownerId,
    provider: "github",
    status: "connected",
    displayName: `@${test.login}`,
    metadata: { login: test.login, quickConnect: true },
    lastTestedAt: now,
  });
  await writeConnectionAudit({
    projectId,
    ownerId: verified.data.ownerId,
    provider: "github",
    action: "quick_connect",
    status: "ok",
    message: `Linked account @${test.login}`,
  });

  return NextResponse.json({ ok: true, displayName: `@${test.login}` });
}
