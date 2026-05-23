"use client";

import * as React from "react";
import { Map, Database, Layers, Palette, Gauge } from "lucide-react";

type ProjectMeta = Record<string, unknown>;

export function BlueprintSummaryPanel({
  metadata,
  fileCount,
  routeCount,
  qualityScore,
}: {
  metadata: ProjectMeta;
  fileCount: number;
  routeCount: number;
  qualityScore?: number | null;
}) {
  const blueprint = (metadata.approved_blueprint ?? metadata.blueprint ?? null) as Record<
    string,
    unknown
  > | null;
  const routes = Array.isArray(blueprint?.routeMap)
    ? (blueprint!.routeMap as Array<{ route: string; purpose?: string }>)
    : Array.isArray(metadata.import_routes)
      ? (metadata.import_routes as string[]).map((r) => ({ route: r }))
      : [];
  const dataModel = Array.isArray(blueprint?.dataModel)
    ? (blueprint!.dataModel as Array<{ name: string; columns?: string[] }>)
    : [];
  const templateId =
    typeof metadata.template_id === "string"
      ? metadata.template_id
      : typeof blueprint?.templateId === "string"
        ? blueprint.templateId
        : null;
  const styleId =
    typeof metadata.style_preset_id === "string"
      ? metadata.style_preset_id
      : typeof blueprint?.styleInfluence === "string"
        ? "preset"
        : null;
  const tier = typeof metadata.build_tier === "string" ? metadata.build_tier : null;
  const backendReq = Array.isArray(blueprint?.backendRequirements)
    ? (blueprint!.backendRequirements as string[])
    : [];

  return (
    <div className="rounded-xl bg-white/90 p-3 ring-1 ring-border/70 space-y-3">
      <div className="flex items-center gap-2">
        <Map className="size-3.5 text-accent" />
        <p className="text-[11px] font-semibold text-foreground">Blueprint & structure</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <MetaChip icon={Layers} label="Template" value={templateId ?? "Custom prompt"} />
        <MetaChip icon={Palette} label="Style" value={styleId ?? "Default"} />
        <MetaChip icon={Gauge} label="Quality" value={qualityScore != null ? `${qualityScore}/100` : "—"} />
        <MetaChip icon={Database} label="Tables" value={String(dataModel.length || "—")} />
      </div>

      {tier && (
        <p className="text-[10px] text-muted-foreground">
          Build tier: <span className="font-medium text-foreground capitalize">{tier}</span>
        </p>
      )}

      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Routes ({routeCount || routes.length})</p>
        <ul className="max-h-24 space-y-0.5 overflow-y-auto text-[10px] text-foreground">
          {(routes.length ? routes : [{ route: "—" }]).slice(0, 8).map((r) => (
            <li key={r.route} className="truncate font-mono">
              {r.route}
              {"purpose" in r && r.purpose ? ` — ${r.purpose}` : ""}
            </li>
          ))}
        </ul>
      </div>

      {backendReq.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Backend plan</p>
          <ul className="space-y-0.5 text-[10px] text-foreground">
            {backendReq.slice(0, 4).map((b) => (
              <li key={b} className="truncate">
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        {fileCount} generated files · {routeCount || routes.length} routes detected
      </p>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-surface px-2 py-1.5 ring-1 ring-border/60">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <p className="mt-0.5 truncate font-medium text-foreground capitalize">{value}</p>
    </div>
  );
}
