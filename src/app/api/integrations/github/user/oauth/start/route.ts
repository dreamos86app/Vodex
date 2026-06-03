import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { githubOAuthConfigured } from "@/lib/integrations/server/github-api";
import { getAppUrl } from "@/lib/app-url";
import { createHmac, randomBytes } from "crypto";
import { isPaidPlan } from "@/lib/billing/plan-features";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function signState(payload: string): string {
  const secret = process.env.GITHUB_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev";
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
}

/** Link GitHub account to Vodex user (one-click for future apps). */
export async function GET(req: Request) {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("plan_id").eq("id", user.id).maybeSingle();
  if (!isPaidPlan(profile?.plan_id)) {
    return NextResponse.json({ error: "GitHub connect requires Pro or higher" }, { status: 403 });
  }

  if (!githubOAuthConfigured()) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured", hint: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/settings/integrations";
  const clientId = process.env.GITHUB_CLIENT_ID!.trim();
  const nonce = randomBytes(8).toString("hex");
  const raw = `user:${user.id}:${encodeURIComponent(returnTo)}:${nonce}`;
  const state = `${Buffer.from(raw).toString("base64url")}.${signState(raw)}`;

  const redirectUri = `${getAppUrl().replace(/\/$/, "")}/api/integrations/github/callback`;
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo,read:user");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
