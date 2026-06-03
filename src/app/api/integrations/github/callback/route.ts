import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import {
  saveProjectSecret,
  upsertProjectIntegration,
  writeConnectionAudit,
} from "@/lib/integrations/server/integration-store";
import { testGitHubConnection } from "@/lib/integrations/server/github-api";
import { saveUserProviderConnection } from "@/lib/integrations/server/user-provider-connections";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

function signState(payload: string): string {
  const secret = process.env.GITHUB_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev";
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
}

async function applyGitHubToken(opts: {
  accessToken: string;
  projectId?: string;
  ownerId: string;
}) {
  const test = await testGitHubConnection(opts.accessToken);
  if (!test.ok) {
    return { ok: false as const, error: test.error ?? "GitHub test failed" };
  }

  await saveUserProviderConnection({
    userId: opts.ownerId,
    provider: "github",
    accessToken: opts.accessToken,
    displayName: `@${test.login}`,
    metadata: { login: test.login, oauth: true },
  });

  if (opts.projectId) {
    const now = new Date().toISOString();
    await saveProjectSecret({
      projectId: opts.projectId,
      ownerId: opts.ownerId,
      provider: "github",
      keyName: "GITHUB_TOKEN",
      value: opts.accessToken,
    });
    await upsertProjectIntegration({
      projectId: opts.projectId,
      ownerId: opts.ownerId,
      provider: "github",
      status: "connected",
      displayName: `@${test.login}`,
      metadata: { login: test.login, oauth: true, linkedAccount: true },
      lastTestedAt: now,
    });
    await writeConnectionAudit({
      projectId: opts.projectId,
      ownerId: opts.ownerId,
      provider: "github",
      action: "connect",
      status: "ok",
      message: `OAuth connected as ${test.login}`,
    });
  }

  return { ok: true as const, login: test.login };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const base = getAppUrl().replace(/\/$/, "");

  if (!code || !state) {
    return NextResponse.redirect(`${base}/settings/integrations?github=error&reason=missing_code`);
  }

  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) {
    return NextResponse.redirect(`${base}/settings/integrations?github=error&reason=bad_state`);
  }

  let raw: string;
  try {
    raw = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return NextResponse.redirect(`${base}/settings/integrations?github=error&reason=bad_state`);
  }

  if (signState(raw) !== sig) {
    return NextResponse.redirect(`${base}/settings/integrations?github=error&reason=invalid_state`);
  }

  const parts = raw.split(":");
  const mode = parts[0];

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/settings/integrations?github=error&reason=oauth_not_configured`);
  }

  const redirectUri = `${base}/api/integrations/github/callback`;
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.redirect(
      `${base}/settings/integrations?github=error&reason=${encodeURIComponent(tokenJson.error ?? "token_exchange_failed")}`,
    );
  }

  try {
    if (mode === "user") {
      const ownerId = parts[1];
      const returnTo = decodeURIComponent(parts[2] ?? "/settings/integrations");
      if (!ownerId) throw new Error("invalid_state");
      const result = await applyGitHubToken({
        accessToken: tokenJson.access_token,
        ownerId,
      });
      if (!result.ok) {
        return NextResponse.redirect(
          `${base}${returnTo}${returnTo.includes("?") ? "&" : "?"}github=error&reason=${encodeURIComponent(result.error)}`,
        );
      }
      return NextResponse.redirect(
        `${base}${returnTo}${returnTo.includes("?") ? "&" : "?"}github=linked`,
      );
    }

    const projectId = parts[0];
    const ownerId = parts[1];
    if (!projectId || !ownerId) {
      return NextResponse.redirect(`${base}/settings/integrations?github=error&reason=invalid_state`);
    }

    const result = await applyGitHubToken({
      accessToken: tokenJson.access_token,
      projectId,
      ownerId,
    });
    if (!result.ok) {
      return NextResponse.redirect(
        `${base}/apps/${projectId}/builder?github=error&reason=${encodeURIComponent(result.error)}`,
      );
    }

    return NextResponse.redirect(
      `${base}/apps/${projectId}/builder?tab=dashboard&section=integrations&github=connected`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save_failed";
    return NextResponse.redirect(
      `${base}/settings/integrations?github=error&reason=${encodeURIComponent(msg)}`,
    );
  }
}
