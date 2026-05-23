import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DeploymentHistoryRow = {
  id: string;
  project_id: string;
  provider: string;
  status: string;
  deployment_url: string | null;
  provider_deployment_id: string | null;
  metadata?: { error?: string } | null;
  created_at: string;
  projects?: { name?: string } | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("project_deployments" as never)
    .select("id, project_id, provider, status, deployment_url, provider_deployment_id, created_at, metadata, projects(name)")
    .eq("user_id" as never, user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deployments: (data ?? []) as DeploymentHistoryRow[] });
}
