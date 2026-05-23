#!/usr/bin/env node
/**
 * Deploy system fixture tests — run via verify:deploy (tsx).
 */
import { getVercelServerConfig } from "../src/lib/deploy/vercel-config";
import { assessVercelReadiness } from "../src/lib/deploy/vercel-readiness";
import { missingVercelEnvVars } from "../src/lib/deploy/vercel-connection";
import { buildPublicUrl } from "../src/lib/publish/public-url";
import { publicWebUrlForSubdomain } from "../src/lib/publish/subdomain";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const savedToken = process.env.VERCEL_ACCESS_TOKEN;
  const savedProject = process.env.VERCEL_PROJECT_ID;
  const savedWildcard = process.env.DREAMOS_WILDCARD_SUBDOMAIN;
  const savedDns = process.env.DREAMOS_DNS_VERIFIED;

  try {
    delete process.env.VERCEL_ACCESS_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
    assert(getVercelServerConfig().state === "not_connected", "no token = not_connected");
    assert(missingVercelEnvVars().includes("VERCEL_ACCESS_TOKEN"), "missing token env");
    const notConn = assessVercelReadiness({
      state: "not_connected",
      hasToken: false,
      projectLinked: false,
    });
    assert(notConn.state === "not_connected", "assess not_connected");

    process.env.VERCEL_ACCESS_TOKEN = "bad-token";
    delete process.env.VERCEL_PROJECT_ID;
    assert(getVercelServerConfig().state === "needs_project_link", "token only = needs_project_link");
    const needsLink = assessVercelReadiness({
      state: "needs_project_link",
      hasToken: true,
      projectLinked: false,
    });
    assert(needsLink.state === "blocked", "missing project = blocked");

    process.env.VERCEL_PROJECT_ID = "prj_test";
    assert(getVercelServerConfig().state === "ready", "token + project = ready");
    const ready = assessVercelReadiness({
      state: "ready",
      hasToken: true,
      projectLinked: true,
    });
    assert(ready.state === "ready", "ready when linked");

    const invalid = assessVercelReadiness({
      state: "token_invalid",
      hasToken: true,
      projectLinked: true,
    });
    assert(invalid.state === "failed", "invalid token = failed readiness");

    delete process.env.DREAMOS_WILDCARD_SUBDOMAIN;
    delete process.env.DREAMOS_DNS_VERIFIED;
    const pathUrl = buildPublicUrl("my-app");
    assert(pathUrl.mode === "path", "DNS not verified → path mode");
    assert(pathUrl.url.includes("/p/my-app"), "path URL uses /p/slug");
    assert(publicWebUrlForSubdomain("my-app") === pathUrl.url, "subdomain helper honest");

    process.env.DREAMOS_WILDCARD_SUBDOMAIN = "1";
    delete process.env.DREAMOS_DNS_VERIFIED;
    const stillPath = buildPublicUrl("my-app");
    assert(stillPath.mode === "path", "wildcard flag alone does not enable subdomain");

    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
    const start = fs.readFileSync(
      path.join(root, "src/app/api/deploy/vercel/start/route.ts"),
      "utf8",
    );
    assert(start.includes("guardExpensiveRoute"), "start uses guardExpensiveRoute");
    assert(start.includes("requireMutationProjectId"), "start validates projectId");
    assert(start.includes("requireOwnedProject"), "start checks ownership");
    assert(start.includes("deployment_url: deploymentUrl"), "success stores URL");
    assert(start.includes('status: "failed"'), "failure stores failed status");
    assert(start.includes("logs:"), "failure stores logs");
    assert(!start.includes("fake"), "no fake deploy");

    const status = fs.readFileSync(
      path.join(root, "src/app/api/deploy/vercel/status/route.ts"),
      "utf8",
    );
    assert(status.includes("getVercelDeployment"), "status polls Vercel");
    assert(!status.includes("last_deployment_url"), "status does not fake URL from meta");

    console.log("deploy-tests: all passed");
  } finally {
    if (savedToken === undefined) delete process.env.VERCEL_ACCESS_TOKEN;
    else process.env.VERCEL_ACCESS_TOKEN = savedToken;
    if (savedProject === undefined) delete process.env.VERCEL_PROJECT_ID;
    else process.env.VERCEL_PROJECT_ID = savedProject;
    if (savedWildcard === undefined) delete process.env.DREAMOS_WILDCARD_SUBDOMAIN;
    else process.env.DREAMOS_WILDCARD_SUBDOMAIN = savedWildcard;
    if (savedDns === undefined) delete process.env.DREAMOS_DNS_VERIFIED;
    else process.env.DREAMOS_DNS_VERIFIED = savedDns;
  }
}

main().catch((e) => {
  console.error("deploy-tests failed:", e.message);
  process.exit(1);
});
