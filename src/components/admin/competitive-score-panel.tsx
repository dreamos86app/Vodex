"use client";

import * as React from "react";
import { AlertTriangle, Trophy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  index: number;
  title: string;
  cappedScore: number;
  lovableScore: number;
  base44Score: number;
  lovableSource: string;
  base44Source: string;
  winner: string;
  riskLevel: string;
  blockers: string[];
  hasE2eProof: boolean;
  hasStubRisk: boolean;
  proofArtifact: string | null;
  fixToReach100: string;
};

type Payload = {
  aggregate: { dreamos: number; lovable: number; base44: number; dreamosWins: number; total: number };
  categories: Row[];
  below90Count: number;
  scoringRules: string[];
};

export function CompetitiveScorePanel() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/competitive-score")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setData(j as Payload);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading competitive scores…</p>;
  }
  if (err) {
    return (
      <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20">
        {err}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="dashboard-shell space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">Competitive readiness scoreboard</h2>
          <p className="text-[12px] text-muted-foreground">
            Evidence-based caps — not marketing. Lovable/Base44 marked estimated unless measured.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-[12px] ring-1 ring-border"
        >
          <RefreshCw className="size-3.5" strokeWidth={1.75} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="DreamOS86 (capped avg)" value={`${data.aggregate.dreamos}%`} />
        <Stat label="Lovable (estimated avg)" value={`${data.aggregate.lovable}%`} />
        <Stat label="Base44 (estimated avg)" value={`${data.aggregate.base44}%`} />
        <Stat label="DreamOS wins" value={`${data.aggregate.dreamosWins}/${data.aggregate.total}`} />
      </div>

      {data.below90Count > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-[12px] ring-1 ring-amber-500/25">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          <span>{data.below90Count} categories below 90 — see blockers. Run verify:e2e and benchmark:score.</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl ring-1 ring-border">
        <table className="w-full min-w-[900px] text-left text-[11px]">
          <thead className="bg-surface text-muted-foreground">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">DreamOS</th>
              <th className="px-2 py-2">Lovable</th>
              <th className="px-2 py-2">Base44</th>
              <th className="px-2 py-2">Winner</th>
              <th className="px-2 py-2">Proof</th>
              <th className="px-2 py-2">Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="px-2 py-2">{c.index}</td>
                <td className="max-w-[200px] px-2 py-2 font-medium">{c.title}</td>
                <td className={cn("px-2 py-2 font-semibold", scoreColor(c.cappedScore))}>{c.cappedScore}</td>
                <td className="px-2 py-2 text-muted-foreground">
                  {c.lovableScore}
                  <span className="ml-1 text-[9px]">({c.lovableSource})</span>
                </td>
                <td className="px-2 py-2 text-muted-foreground">
                  {c.base44Score}
                  <span className="ml-1 text-[9px]">({c.base44Source})</span>
                </td>
                <td className="px-2 py-2">
                  {c.winner === "dreamos" && <Trophy className="size-3.5 text-accent" />}
                  <span className="ml-1 capitalize">{c.winner}</span>
                </td>
                <td className="px-2 py-2">
                  {c.proofArtifact ?? "—"}
                  {c.hasStubRisk && <span className="text-destructive"> stub</span>}
                </td>
                <td className="px-2 py-2 capitalize">{c.riskLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="text-[12px]">
        <summary className="cursor-pointer font-medium">Blockers & fixes to reach 100</summary>
        <ul className="mt-2 space-y-2">
          {data.categories
            .filter((c) => c.cappedScore < 100)
            .map((c) => (
              <li key={c.id} className="rounded-lg bg-surface p-2 ring-1 ring-border">
                <strong>{c.title}</strong> ({c.cappedScore}/100)
                {c.blockers.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {c.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-accent">{c.fixToReach100}</p>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-[18px] font-semibold">{value}</p>
    </div>
  );
}

function scoreColor(n: number) {
  if (n >= 90) return "text-positive";
  if (n >= 75) return "text-foreground";
  return "text-amber-500";
}
