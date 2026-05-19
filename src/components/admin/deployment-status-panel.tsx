"use client";

import * as React from "react";
import { CheckCircle2, XCircle, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeploymentStatus = {
  checkedAt: string;
  appUrl: string;
  productionDomain: string;
  supabase: { expectedRef: string; refMatch: boolean; urlConfigured: boolean };
  env: {
    present: Record<string, boolean>;
    serviceRoleOk: boolean;
    llmOk: boolean;
    appUrlIsProduction: boolean;
  };
  legal: { termsReachable: boolean; privacyReachable: boolean };
  packages: { speedInsightsInstalled: boolean };
  reminders: string[];
};

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2 py-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={1.75} />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.75} />
      )}
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-foreground">{label}</p>
        {detail ? <p className="text-[11px] text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

export function DeploymentStatusPanel() {
  const [data, setData] = React.useState<DeploymentStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/deployment-status", { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as DeploymentStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-[var(--radius-xl)] bg-surface ring-1 ring-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Deployment status
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="gap-1.5 h-7 text-[11px]"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Refresh
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="px-4 py-6 text-[12px] text-destructive">{error}</p>
      ) : data ? (
        <div className="divide-y divide-border px-4 py-2">
          <Row
            ok={data.env.appUrlIsProduction}
            label="NEXT_PUBLIC_APP_URL is production"
            detail={data.appUrl}
          />
          <Row
            ok={data.supabase.refMatch}
            label="Supabase project ref"
            detail={`Expected ${data.supabase.expectedRef}`}
          />
          <Row
            ok={data.env.serviceRoleOk}
            label="Service role key present"
            detail="SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY"
          />
          <Row ok={data.env.llmOk} label="At least one LLM key" />
          <Row ok={data.legal.termsReachable} label="/terms reachable" />
          <Row ok={data.legal.privacyReachable} label="/privacy reachable" />
          <Row ok={data.packages.speedInsightsInstalled} label="@vercel/speed-insights installed" />

          <div className="py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Env vars (names only)
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(data.env.present).map(([name, ok]) => (
                <li key={name} className={cn("font-mono text-[10px]", ok ? "text-positive" : "text-muted-foreground")}>
                  {ok ? "✓" : "○"} {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reminders</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              {data.reminders.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <a
              href={data.productionDomain}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
            >
              Open {data.productionDomain}
              <ExternalLink className="size-2.5" />
            </a>
          </div>
          <p className="pb-2 text-[10px] text-muted-foreground/70">
            Checked {new Date(data.checkedAt).toLocaleString()}
          </p>
        </div>
      ) : null}
    </div>
  );
}
