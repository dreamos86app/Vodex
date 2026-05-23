import type { Metadata } from "next";
import { Suspense } from "react";
import { requireServerUser } from "@/lib/auth/session";
import { PremiumCreateFunnel } from "@/components/create/premium-create-funnel";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Create",
  description: "DreamOS86 create workspace — build with AI.",
};

export default async function WorkspaceCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string; projectId?: string }>;
}) {
  const { prompt, projectId } = await searchParams;
  const nextPath = `/create${prompt || projectId ? `?${new URLSearchParams({ ...(prompt ? { prompt } : {}), ...(projectId ? { projectId } : {}) }).toString()}` : ""}`;
  await requireServerUser(nextPath);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="size-5 animate-spin text-muted-foreground/40" strokeWidth={1.75} />
        </div>
      }
    >
      <PremiumCreateFunnel initialPrompt={prompt ?? ""} initialProjectId={projectId ?? null} />
    </Suspense>
  );
}
