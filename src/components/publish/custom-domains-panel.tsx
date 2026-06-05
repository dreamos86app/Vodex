"use client";

import * as React from "react";
import { Copy, Globe, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type DomainRow = {
  id: string;
  hostname: string;
  status: string;
  verification_token?: string;
  dns_records?: Record<string, unknown>;
  failure_reason?: string | null;
};

export function CustomDomainsPanel({
  projectId,
  canUseCustomDomain,
  publishedSubdomain,
}: {
  projectId: string;
  canUseCustomDomain: boolean;
  publishedSubdomain?: string | null;
}) {
  const [domains, setDomains] = React.useState<DomainRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hostname, setHostname] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/custom-domains`, { credentials: "include" });
      if (r.ok) {
        const body = (await r.json()) as { domains?: DomainRow[] };
        setDomains(body.domains ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function addDomain() {
    if (!hostname.includes(".")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/custom-domains`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.error ?? "Could not add domain");
        return;
      }
      toast.success("Domain added — configure DNS below");
      setHostname("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/custom-domains`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", domainId: id }),
      });
      const body = await r.json();
      if (body.ok) toast.success("Domain verified and active");
      else toast.info(body.status === "pending_dns" ? "DNS not ready yet" : "Partial verification");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canUseCustomDomain) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Custom domains are available on Starter plans and above.{" "}
        <a href="/billing" className="font-medium text-accent">
          Upgrade
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="custom-domains-panel">
      {publishedSubdomain && (
        <div className="rounded-xl bg-surface px-3 py-2 text-[12px] ring-1 ring-border">
          <span className="text-muted-foreground">Vodex subdomain: </span>
          <span className="font-medium">{publishedSubdomain}.vodex.app</span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="app.example.com"
          className="flex-1 rounded-xl bg-background px-3 py-2 text-[12px] ring-1 ring-border"
        />
        <button
          type="button"
          disabled={busy || !hostname.includes(".")}
          onClick={() => void addDomain()}
          className="rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
        >
          Add domain
        </button>
      </div>

      {loading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <ul className="space-y-3">
          {domains.map((d) => (
            <li key={d.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-accent" />
                <span className="flex-1 text-[13px] font-semibold">{d.hostname}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    d.status === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600",
                  )}
                >
                  {d.status.replace(/_/g, " ")}
                </span>
              </div>
              {d.status !== "active" && (
                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  <p>
                    CNAME <code>{d.hostname}</code> → <code>cname.vodex.dev</code>
                    <button
                      type="button"
                      className="ml-1 inline text-accent"
                      onClick={() => void navigator.clipboard.writeText("cname.vodex.dev")}
                    >
                      <Copy className="inline size-3" />
                    </button>
                  </p>
                  <p>
                    TXT <code>_vodex.{d.hostname}</code> →{" "}
                    <code>vodex-verify={d.verification_token}</code>
                  </p>
                </div>
              )}
              {d.failure_reason && d.status !== "active" && (
                <p className="mt-1 text-[11px] text-destructive">{d.failure_reason}</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void verifyDomain(d.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ring-1 ring-border"
                >
                  <RefreshCw className="size-3" /> Verify DNS
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
