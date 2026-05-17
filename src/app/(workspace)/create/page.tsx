import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImmersiveWorkspace } from "@/components/create/workspace/immersive-workspace";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Create — DreamOS86",
  description: "AI orchestration workspace.",
};

export default async function WorkspaceCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string; projectId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { prompt, projectId } = await searchParams;

  // If a projectId is provided, fetch the project
  let project = null;
  if (projectId) {
    const { data } = await supabase
      .from("projects")
      .select("id, name, preview_url")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .single();
    project = data;
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="size-5 animate-spin text-muted-foreground/40" strokeWidth={1.75} />
        </div>
      }
    >
      <ImmersiveWorkspace
        initialPrompt={prompt ?? ""}
        project={project}
      />
    </Suspense>
  );
}
