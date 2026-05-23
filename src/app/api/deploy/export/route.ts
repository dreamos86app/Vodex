import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";
import { DREAMOS_SUPABASE_PROJECT_REF } from "@/lib/supabase/project-ref";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";

const SECRET_PATTERN = /(service_role|SUPABASE_SERVICE|sk_live|sk_test_[a-z0-9]{20,})/i;

function isSecretPath(path: string): boolean {
  return (
    /\.env(\.|$)/i.test(path) ||
    path.includes("node_modules") ||
    path.includes(".next/") ||
    /secret|credential/i.test(path)
  );
}

const README_DEPLOY = `# DreamOS86 export

## Deploy checklist

1. Copy \`.env.example\` to \`.env.local\` and fill values (never commit secrets).
2. Run \`npm install\` then \`npm run build\`.
3. Apply Supabase migrations on project **${DREAMOS_SUPABASE_PROJECT_REF}**:
   - \`supabase/migrations/20260603120000_credit_economy_tables.sql\` (if using DreamOS billing features)
4. Set \`NEXT_PUBLIC_SUPABASE_URL\` to your Supabase project URL.
5. Deploy to Vercel, Netlify, or your host — connect GitHub for CI if preferred.

## Vercel

Server-side only (never in browser):
- \`VERCEL_ACCESS_TOKEN\`
- Optional: \`VERCEL_TEAM_ID\`, \`VERCEL_PROJECT_ID\`

Use DreamOS86 deploy center **Connect Vercel** when OAuth/token integration is enabled.

## Security

- Do not expose service role keys to the client.
- Do not set \`NODE_TLS_REJECT_UNAUTHORIZED=0\` in production.
`;

const ENV_EXAMPLE = `# Copy to .env.local
NEXT_PUBLIC_SUPABASE_URL=https://${DREAMOS_SUPABASE_PROJECT_REF}.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Server only — never NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=
`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const body = await request.json().catch(() => ({}));
  const authUser = guardExpensiveRoute(sessionUser, "deploy", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const projectId = requireMutationProjectId((body as { projectId?: string }).projectId);
  if (isNextResponse(projectId)) return projectId;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, framework")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();

  if (!project?.id) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: files, error } = await supabase
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!files?.length) return NextResponse.json({ error: "No files to export" }, { status: 404 });

  const zip = new JSZip();
  let included = 0;
  for (const f of files) {
    if (!f.path || f.content == null) continue;
    if (isSecretPath(f.path)) continue;
    if (SECRET_PATTERN.test(f.content)) continue;
    zip.file(f.path, f.content);
    included++;
  }

  const pkg = {
    name: (project.name ?? "dreamos-app").toLowerCase().replace(/\s+/g, "-"),
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
    },
    dependencies: {
      next: "^16.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
  };
  if (!zip.file("package.json")) {
    zip.file("package.json", JSON.stringify(pkg, null, 2));
  }
  zip.file("README_DEPLOY.md", README_DEPLOY);
  zip.file(".env.example", ENV_EXAMPLE);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dreamos-export-${projectId.slice(0, 8)}.zip"`,
      "X-DreamOS-Files-Included": String(included),
    },
  });
}
