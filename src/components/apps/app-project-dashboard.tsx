"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";
import { AppDashboardPanel, type DashSection } from "@/components/create/workspace/app-dashboard-panel";
import { ProjectIntegrationsPanel } from "@/components/integrations/project-integrations-panel";
import { isZipImportProject } from "@/lib/projects/imported-project-state";
import {
  LayoutGrid,
  MonitorPlay,
  KeyRound,
  Rocket,
  ScrollText,
  Settings,
  Plug,
} from "lucide-react";

type ProjectRow = Pick<
  Tables<"projects">,
  "id" | "name" | "status" | "preview_url" | "custom_domain" | "framework" | "gradient" | "metadata" | "is_public"
>;

const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "preview", label: "Preview", icon: MonitorPlay },
  { id: "setup", label: "Setup", icon: KeyRound },
  { id: "publish", label: "Publish", icon: Rocket },
  { id: "activity", label: "Activity", icon: ScrollText },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function AppProjectDashboard({ project }: { project: ProjectRow }) {
  const [active, setActive] = React.useState<DashSection>("overview");
  const isImport = isZipImportProject(project.metadata);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-surface/80 p-1 ring-1 ring-border lg:w-52 lg:flex-col lg:gap-0.5">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const on = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id as DashSection)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium transition whitespace-nowrap",
                on ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={1.65} />
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-[420px] flex-1 overflow-hidden rounded-[var(--radius-xl)] ring-1 ring-border bg-background">
        <div className="border-b border-border bg-gradient-to-r from-accent/[0.06] to-transparent px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
        <div className="max-h-[min(70vh,720px)] overflow-y-auto">
          {active === "integrations" ? (
            <ProjectIntegrationsPanel projectId={project.id} />
          ) : (
            <AppDashboardPanel
              project={project}
              isBusy={false}
              activeSection={active}
              onSectionChange={setActive}
            />
          )}
        </div>
      </div>
    </div>
  );
}
