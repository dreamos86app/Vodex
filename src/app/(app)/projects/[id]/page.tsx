import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectDashboard } from "@/components/projects/project-dashboard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return {
    title: data?.name ?? "Project",
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // RLS guarantees the user can only see their own projects.
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (projectErr || !project) notFound();

  const [{ data: deployments }, { data: memory }] = await Promise.all([
    supabase
      .from("deployments")
      .select(
        "id, status, environment, url, build_duration_ms, commit_message, error_message, created_at",
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("project_memory")
      .select("category, key, value, importance, updated_at")
      .eq("project_id", id)
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <ProjectDashboard
      project={project as never}
      deployments={(deployments ?? []) as never}
      memory={(memory ?? []) as never}
    />
  );
}
