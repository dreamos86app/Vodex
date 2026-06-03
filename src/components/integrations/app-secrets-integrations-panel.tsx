"use client";

import * as React from "react";
import { Loader2, Plug, Shield, TestTube2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  INTEGRATION_PROVIDERS,
  type IntegrationProviderDef,
} from "@/lib/generated-apps/integration-registry";
import { detectRequiredIntegrations } from "@/lib/generated-apps/integration-requirements";

type SecretRow = {
  key_name: string;
  provider?: string | null;
  status?: string | null;
  last_four?: string | null;
  updated_at?: string | null;
  last_tested_at?: string | null;
};

export function AppSecretsIntegrationsPanel({
  projectId,
  appPrompt,
}: {
  projectId: string;
  appPrompt?: string;
}) {
  const [rows, setRows] = React.useState<SecretRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeProvider, setActiveProvider] = React.useState<IntegrationProviderDef | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const requirements = React.useMemo(
    () => detectRequiredIntegrations(appPrompt ?? ""),
    [appPrompt],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/secrets`, { credentials: "include" });
      const json = (await res.json()) as { secrets?: SecretRow[]; keys?: SecretRow[] };
      setRows(json.secrets ?? json.keys ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const configuredKeys = new Set(rows.map((r) => r.key_name));

  async function saveField(keyName: string, value: string, providerId: string) {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyName, value, provider: providerId }),
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not save secret");
        return;
      }
      toast.success(`${keyName} saved securely`);
      setValues((v) => ({ ...v, [keyName]: "" }));
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveProvider(provider: IntegrationProviderDef, partial: boolean) {
    const required = provider.fields.filter((f) => f.required);
    const missing = required.filter((f) => !values[f.key]?.trim());
    if (!partial && missing.length > 0) {
      toast.error(`Missing: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    for (const field of provider.fields) {
      const v = values[field.key]?.trim();
      if (v) await saveField(field.key, v, provider.id);
    }
    setActiveProvider(null);
  }

  async function testProvider(providerId: string) {
    setTesting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/${providerId}/test`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Connection test failed");
        return;
      }
      toast.success("Connection OK");
      await load();
    } catch {
      toast.error("Test unavailable for this provider yet");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="app-secrets-integrations-panel">
      <div className="flex items-start gap-2 rounded-xl bg-sky-500/5 px-3 py-2.5 ring-1 ring-sky-500/15">
        <Shield className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Secrets are encrypted at rest. Values are never shown again after save. Collaborators cannot view secret values.
        </p>
      </div>

      {requirements.length > 0 ? (
        <div className="space-y-2" data-testid="missing-secret-checklist">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Detected requirements
          </p>
          {requirements.map((r) => {
            const configured = INTEGRATION_PROVIDERS.find((p) => p.id === r.provider)?.secretKeys.some((k) =>
              configuredKeys.has(k),
            );
            return (
              <div
                key={r.provider}
                className={cn(
                  "rounded-lg px-3 py-2 text-[12px] ring-1",
                  configured
                    ? "bg-emerald-500/5 text-emerald-800 ring-emerald-500/20 dark:text-emerald-200"
                    : "bg-amber-500/5 text-amber-900 ring-amber-500/20 dark:text-amber-200",
                )}
              >
                {configured ? "Configured" : r.dashboardMessage}
              </div>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {INTEGRATION_PROVIDERS.map((p) => {
            const keys = p.secretKeys.length ? p.secretKeys : p.fields.map((f) => f.key);
            const done = keys.filter((k) => configuredKeys.has(k)).length;
            const status =
              done === 0 ? "missing" : done < keys.filter((k) => p.fields.find((f) => f.key === k)?.required).length ? "incomplete" : "configured";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveProvider(p);
                  setValues({});
                }}
                className="flex flex-col items-start gap-1 rounded-xl bg-surface px-3 py-3 text-left ring-1 ring-border transition hover:ring-accent/40"
                data-testid={`integration-provider-${p.id}`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    <Plug className="size-3.5 text-accent" />
                    {p.label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                      status === "configured" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                      status === "incomplete" && "bg-amber-500/10 text-amber-800 dark:text-amber-200",
                      status === "missing" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>
              </button>
            );
          })}
        </div>
      )}

      {activeProvider ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          data-testid="integration-secret-drawer"
        >
          <div className="max-h-[min(90dvh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-4 shadow-2xl ring-1 ring-border">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-foreground">{activeProvider.label}</h3>
              <button type="button" onClick={() => setActiveProvider(null)} className="rounded-lg p-1 hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              {activeProvider.fields.map((field) => (
                <div key={field.key} data-testid={`integration-field-${field.key}`}>
                  <label className="text-[12px] font-medium text-foreground">
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </label>
                  <input
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    placeholder={field.placeholder ?? (field.secret ? "Paste once — never shown again" : "")}
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-surface px-3 py-2.5 text-[13px] ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground" data-testid="integration-field-guide">
                    How to get this: {field.guide}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveProvider(activeProvider, false)}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Save"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveProvider(activeProvider, true)}
                className="rounded-xl px-4 py-2.5 text-[13px] font-medium text-muted-foreground ring-1 ring-border"
              >
                Save partial
              </button>
              <button
                type="button"
                disabled={testing}
                onClick={() => void testProvider(activeProvider.id)}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium ring-1 ring-border"
              >
                <TestTube2 className="size-3.5" />
                Test
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
