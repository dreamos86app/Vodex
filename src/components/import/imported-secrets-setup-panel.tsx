"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Shield, ExternalLink, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type EnvReq = { key: string; required?: boolean; provider?: string };

const PROVIDER_FOR_KEY: Record<string, string> = {
  SUPABASE_URL: "Supabase",
  SUPABASE_ANON_KEY: "Supabase",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase",
  NEXT_PUBLIC_SUPABASE_URL: "Supabase",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase",
  OPENAI_API_KEY: "OpenAI",
  ANTHROPIC_API_KEY: "Anthropic",
  GOOGLE_GENERATIVE_AI_API_KEY: "Google AI",
  STRIPE_SECRET_KEY: "Stripe",
  STRIPE_PUBLISHABLE_KEY: "Stripe",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "Stripe",
  RESEND_API_KEY: "Resend",
  FIREBASE_API_KEY: "Firebase",
  GITHUB_TOKEN: "GitHub",
  GOOGLE_OAUTH_CLIENT_ID: "Google OAuth",
  GOOGLE_OAUTH_CLIENT_SECRET: "Google OAuth",
  DATABASE_URL: "Database",
};

function providerForKey(key: string): string {
  if (PROVIDER_FOR_KEY[key]) return PROVIDER_FOR_KEY[key];
  if (key.includes("SUPABASE")) return "Supabase";
  if (key.includes("STRIPE")) return "Stripe";
  if (key.includes("FIREBASE")) return "Firebase";
  if (key.startsWith("VITE_")) return "Vite env";
  if (key.startsWith("NEXT_PUBLIC_")) return "Public env";
  return "Environment";
}

function normalizeEnvReqs(raw: unknown): EnvReq[] {
  if (!Array.isArray(raw)) return [];
  const out: EnvReq[] = [];
  for (const item of raw) {
    if (typeof item === "string") out.push({ key: item, required: true });
    else if (item && typeof item === "object" && "key" in item) {
      const o = item as { key?: string; public?: boolean };
      if (o.key) out.push({ key: o.key, required: true, provider: providerForKey(o.key) });
    }
  }
  return out;
}

export function ImportedSecretsSetupPanel({
  projectId,
  envRequirements,
  className,
  onSaved,
}: {
  projectId: string;
  envRequirements: unknown;
  className?: string;
  onSaved?: () => void;
}) {
  const reqs = React.useMemo(() => normalizeEnvReqs(envRequirements), [envRequirements]);
  const grouped = React.useMemo(() => {
    const m = new Map<string, EnvReq[]>();
    for (const r of reqs) {
      const p = r.provider ?? providerForKey(r.key);
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(r);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [reqs]);

  const [configured, setConfigured] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [submittingAll, setSubmittingAll] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>({});

  const keysSig = reqs.map((r) => r.key).join(",");

  React.useEffect(() => {
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/secrets`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { keys?: Array<{ name: string }> } | null) => {
        if (!cancelled && j?.keys) setConfigured(new Set(j.keys.map((k) => k.name)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, keysSig]);

  async function saveOne(keyName: string) {
    const value = values[keyName]?.trim();
    if (!value) return;
    setSaving(keyName);
    try {
      const r = await fetch(`/api/projects/${projectId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyName, value }),
      });
      const j = (await r.json()) as { error?: string; hint?: string };
      if (!r.ok) {
        toast.error(j.hint ? `${j.error} — ${j.hint}` : (j.error ?? "Save failed"));
        return;
      }
      setConfigured((prev) => new Set(prev).add(keyName));
      setValues((v) => ({ ...v, [keyName]: "" }));
      toast.success(`${keyName} saved securely`);
      onSaved?.();
    } finally {
      setSaving(null);
    }
  }

  async function submitAll() {
    const pending = reqs.filter((r) => values[r.key]?.trim() && !configured.has(r.key));
    if (pending.length === 0) {
      toast.info("Enter values for secrets you want to save.");
      return;
    }
    setSubmittingAll(true);
    try {
      for (const r of pending) {
        await saveOne(r.key);
      }
    } finally {
      setSubmittingAll(false);
    }
  }

  if (reqs.length === 0) {
    return (
      <div className={cn("rounded-xl bg-emerald-500/8 p-4 ring-1 ring-emerald-500/20", className)}>
        <p className="text-[12px] font-medium text-foreground">No required secrets detected</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Your imported app did not reference missing environment variables. You can still add secrets in Integrations.
        </p>
      </div>
    );
  }

  const missingCount = reqs.filter((r) => !configured.has(r.key)).length;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-border/80 bg-surface/60 p-3 ring-1 ring-border/60">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-accent" strokeWidth={1.75} />
          <p className="text-[12px] font-semibold text-foreground">Setup secrets</p>
          {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Secrets from ZIP files are never imported. Add them securely here — values are encrypted server-side and never
          shown again after save. Do not paste secrets into chat.
        </p>
        <p className="mt-2 text-[11px] font-medium text-foreground">
          {missingCount > 0 ? `${missingCount} required secret(s) still needed` : "All detected secrets configured"}
        </p>
      </div>

      {grouped.map(([provider, items]) => (
        <div key={provider} className="rounded-xl ring-1 ring-border/70 bg-background/90 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{provider}</p>
          <ul className="mt-2 space-y-3">
            {items.map((r) => {
              const done = configured.has(r.key);
              return (
                <li key={r.key} className="rounded-lg bg-surface/50 p-2.5 ring-1 ring-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] font-semibold text-foreground">{r.key}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.required !== false ? "Required" : "Optional"}
                      </p>
                    </div>
                    {done ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-positive">
                        <CheckCircle2 className="size-3" /> Saved
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-700">
                        <AlertCircle className="size-3" /> Missing
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    autoComplete="off"
                    value={values[r.key] ?? ""}
                    placeholder={done ? "•••••••• (stored)" : "Paste once — masked"}
                    onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  />
                  <Button
                    type="button"
                    size="xs"
                    variant="accent"
                    className="mt-2 h-7 w-full text-[11px]"
                    disabled={saving === r.key || !values[r.key]?.trim()}
                    onClick={() => void saveOne(r.key)}
                  >
                    {saving === r.key ? <Loader2 className="size-3 animate-spin" /> : done ? "Rotate" : "Save securely"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="accent" disabled={submittingAll} onClick={() => void submitAll()}>
          {submittingAll ? <Loader2 className="size-3.5 animate-spin" /> : "Submit all"}
        </Button>
        <Link
          href={`/apps/${projectId}/builder?mode=discuss&prompt=${encodeURIComponent("Help me configure the missing environment variables for this imported app.")}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-[11px] font-semibold text-foreground ring-1 ring-border hover:bg-surface-raised"
        >
          <Sparkles className="size-3.5 text-accent" />
          Ask AI to help connect secrets
          <ExternalLink className="size-3 opacity-60" />
        </Link>
      </div>
    </div>
  );
}
