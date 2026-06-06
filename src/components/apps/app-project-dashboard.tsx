"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";
import { AppDashboardPanel, type DashSection } from "@/components/create/workspace/app-dashboard-panel";
import { ImportPreviewStatusPanel } from "@/components/apps/import-preview-status-panel";
import { isZipImportProject } from "@/lib/projects/imported-project-state";
import { LayoutGrid } from "lucide-react";

type ProjectRow = Pick<
  Tables<"projects">,
  "id" | "name" | "status" | "preview_url" | "custom_domain" | "framework" | "gradient" | "metadata" | "is_public"
>;

export function AppProjectDashboard({ project }: { project: ProjectRow }) {
  const [active, setActive] = React.useState<DashSection>("overview");
  const isImport = isZipImportProject(project.metadata);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] bg-background ring-1 ring-border">
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-accent/[0.06] to-transparent px-4 py-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <LayoutGrid className="size-3.5" />
            {isImport ? "Imported app" : "App dashboard"}
          </p>
          <p className="text-[13px] text-muted-foreground">
            <Link href="/projects" className="font-medium text-accent hover:underline">
              Your apps
            </Link>
            {" · "}
            <Link href={`/apps/${project.id}/builder`} className="font-medium text-accent hover:underline">
              Open builder
            </Link>
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {isImport && (
            <div className="shrink-0 border-b border-border p-4">
              <ImportPreviewStatusPanel appId={project.id} />
            </div>
          )}
          <div className="min-h-0 flex-1">
          <AppDashboardPanel
            project={project}
            isBusy={false}
            activeSection={active}
            onSectionChange={setActive}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
