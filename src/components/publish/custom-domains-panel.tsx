"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Globe,
  Loader2,
  RefreshCw,
  Trash2,
  Lock,
  Shield,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { VodexConfirmModal } from "@/components/ui/vodex-confirm-modal";
import Link from "next/link";

type DomainRow = {
  id: string;
  hostname: string;
  status: string;
  verification_token?: string;
  dns_records?: Record<string, unknown>;
  failure_reason?: string | null;
  verified_at?: string | null;
  last_checked_at?: string | null;
};

function DnsCopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-blue-600"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
          }}
        >
          <Copy className="size-3" /> Copy
        </button>
      </div>
      <code className="mt-1 block break-all font-mono text-[12px] text-foreground">{value}</code>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        active ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-800",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

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
  const [wizardStep, setWizardStep] = React.useState(0);
  const [removeTarget, setRemoveTarget] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (!domains.length) return;
    if (domains.some((d) => d.status === "active")) setWizardStep(2);
    else setWizardStep(1);
  }, [domains]);

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
      setWizardStep(1);
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

  async function removeDomain() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/custom-domains`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", domainId: removeTarget }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.error ?? "Could not remove domain");
        return;
      }
      toast.success("Domain removed");
      setRemoveTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  if (!canUseCustomDomain) {
    return (
      <div className="space-y-4" data-testid="custom-domains-panel">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-indigo-500/10 to-background p-6 ring-1 ring-border/60"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/20 ring-1 ring-violet-500/30">
              <Globe className="size-6 text-violet-600" />
            </div>
            <div>
              <p className="text-[18px] font-semibold text-foreground">Custom domains</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Use your own hostname with automatic SSL and DNS verification.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-background/80 px-4 py-4 text-center ring-1 ring-border/60">
            <Lock className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-[13px] font-semibold">Starter+ required</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Free plans use Vodex subdomains only.</p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex rounded-xl bg-accent px-5 py-2.5 text-[12px] font-semibold text-white"
            >
              View plans
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const activeDomain = domains.find((d) => d.status === "active");

  return (
    <div className="space-y-5" data-testid="custom-domains-panel">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600/15 via-violet-500/10 to-background p-5 ring-1 ring-border/60"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Domains</p>
            <h2 className="mt-1 text-[20px] font-bold text-foreground">Your production hostname</h2>
            <p className="mt-1 max-w-lg text-[13px] text-muted-foreground">
              Connect a custom domain with SSL, DNS verification, and live status monitoring.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
              <Shield className="size-3.5" /> SSL auto
            </span>
            {activeDomain ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-500/20">
                <CheckCircle2 className="size-3.5" /> Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-500/20">
                <AlertCircle className="size-3.5" /> Setup needed
              </span>
            )}
          </div>
        </div>
        {publishedSubdomain ? (
          <div className="mt-4 rounded-xl bg-background/70 px-4 py-3 ring-1 ring-border/50">
            <p className="text-[11px] font-medium text-muted-foreground">Vodex subdomain</p>
            <p className="mt-0.5 font-mono text-[14px] font-semibold text-foreground">
              {publishedSubdomain}.vodex.app
            </p>
          </div>
        ) : null}
      </motion.div>

      <div className="rounded-2xl bg-surface p-4 ring-1 ring-border/70">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <p className="text-[13px] font-semibold">Custom domain wizard</p>
        </div>
        <ol className="mb-4 grid gap-2 sm:grid-cols-3">
          {["Enter hostname", "Configure DNS", "Verify & go live"].map((label, i) => (
            <li
              key={label}
              className={cn(
                "rounded-xl px-3 py-2 text-[11px] font-semibold ring-1",
                wizardStep >= i ? "bg-accent/10 text-accent ring-accent/25" : "bg-muted/30 text-muted-foreground ring-border",
              )}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Use a subdomain (e.g. <code className="font-mono">app</code> or <code className="font-mono">www</code>).
          Root domains like <code className="font-mono">example.com</code> are auto-mapped to{" "}
          <code className="font-mono">www.example.com</code> because CNAME cannot target apex.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={hostname}
            onChange={(e) => {
              setHostname(e.target.value);
              setWizardStep(0);
            }}
            placeholder="app.yourdomain.com or www.yourdomain.com"
            className="flex-1 rounded-xl bg-background px-4 py-3 text-[13px] ring-1 ring-border focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            disabled={busy || !hostname.includes(".")}
            onClick={() => void addDomain()}
            className="cursor-pointer rounded-xl bg-accent px-5 py-3 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add domain
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : domains.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
          <Globe className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-2 text-[13px] font-medium text-foreground">No custom domains yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Add a hostname above to start the wizard.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {domains.map((d) => (
            <li key={d.id} className="rounded-2xl bg-surface p-4 ring-1 ring-border/70">
              <div className="flex flex-wrap items-center gap-2">
                <Globe className="size-4 text-accent" />
                <span className="flex-1 font-mono text-[14px] font-semibold">{d.hostname}</span>
                <StatusPill status={d.status} />
              </div>
              {d.status !== "active" ? (
                <div className="mt-3 space-y-3 rounded-xl bg-muted/30 p-3 text-[12px]">
                  <p className="font-semibold text-foreground">DNS records — add at your domain provider</p>
                  <p className="text-[11px] text-muted-foreground">
                    Step 2: Configure DNS for <span className="font-mono font-semibold">{d.hostname}</span>.
                    After both records propagate, click Verify DNS.
                  </p>
                  {typeof d.dns_records?.apexRedirectNote === "string" ? (
                    <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 ring-1 ring-amber-500/20">
                      {d.dns_records.apexRedirectNote}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">CNAME record</p>
                    <DnsCopyField
                      label="Type"
                      value={String((d.dns_records?.cname as { type?: string } | undefined)?.type ?? "CNAME")}
                    />
                    <DnsCopyField
                      label="Name"
                      value={String((d.dns_records?.cname as { name?: string } | undefined)?.name ?? d.hostname.split(".")[0] ?? "www")}
                    />
                    <DnsCopyField
                      label="Value"
                      value={String((d.dns_records?.cname as { value?: string } | undefined)?.value ?? "cname.vodex.dev")}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">TXT record</p>
                    <DnsCopyField
                      label="Type"
                      value={String((d.dns_records?.txt as { type?: string } | undefined)?.type ?? "TXT")}
                    />
                    <DnsCopyField
                      label="Name"
                      value={String((d.dns_records?.txt as { name?: string } | undefined)?.name ?? `_vodex.${d.hostname.split(".")[0] ?? "www"}`)}
                    />
                    <DnsCopyField
                      label="Value"
                      value={String(
                        (d.dns_records?.txt as { value?: string } | undefined)?.value ??
                          `vodex-verify=${d.verification_token ?? ""}`,
                      )}
                    />
                  </div>
                </div>
              ) : null}
              {d.failure_reason && d.status !== "active" ? (
                <p className="mt-2 text-[11px] text-destructive">{d.failure_reason}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void verifyDomain(d.id)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-accent/10 px-3 py-2 text-[12px] font-semibold text-accent ring-1 ring-accent/25 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="size-3.5" /> Verify DNS
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoveTarget(d.id)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-destructive ring-1 ring-destructive/25 disabled:cursor-not-allowed"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VodexConfirmModal
        open={removeTarget != null}
        title="Remove custom domain?"
        description="Visitors will no longer reach your app on this hostname until you add it again."
        confirmLabel="Remove domain"
        variant="destructive"
        loading={busy}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void removeDomain()}
      />
    </div>
  );
}
