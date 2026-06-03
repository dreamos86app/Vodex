"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Layers } from "lucide-react";
import { IntegrationsCatalogPanel } from "@/components/integrations/integrations-catalog-panel";
import { useAuthStore } from "@/lib/stores/auth-store";

type ProjectRow = { id: string; name: string; app_name?: string | null };

export function SettingsIntegrationsView() {
  const { profile } = useAuthStore();
  const planId = profile?.plan_id ?? "free";
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [projectId, setProjectId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetch("/api/projects", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { projects?: ProjectRow[] } | null) => {
        const list = json?.projects ?? [];
        setProjects(list);
        if (list[0]?.id) setProjectId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const selected = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-6" data-testid="settings-integrations-view">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/[0.06] via-background to-violet-500/[0.04] p-6 ring-1 ring-accent/15">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/25">
            <Layers className="size-6 text-accent" strokeWidth={1.65} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground">App integrations</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              Integrations are scoped per app. Pick an app below to connect GitHub, Supabase, payments, and more.
              Secrets live on each app&apos;s Secrets tab — not here.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-[14px] font-semibold text-foreground">Create an app first</p>
          <Link href="/create" className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white">
            Start building
          </Link>
        </div>
      ) : (
        <>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Configure integrations for
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1.5 w-full max-w-md rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground"
              data-testid="settings-integrations-project-select"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.app_name || p.name}
                </option>
              ))}
            </select>
          </label>
          {projectId ? (
            <IntegrationsCatalogPanel
              projectId={projectId}
              planId={planId}
              onInsertChatPrompt={(prompt) => {
                window.location.href = `/apps/${projectId}/builder?insertPrompt=${encodeURIComponent(prompt)}`;
              }}
            />
          ) : null}
          {selected ? (
            <p className="text-[11px] text-muted-foreground">
              Or open{" "}
              <Link
                href={`/apps/${selected.id}/builder?tab=dashboard&section=integrations`}
                className="font-medium text-accent hover:underline"
              >
                {selected.app_name || selected.name} dashboard → Integrations
              </Link>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
