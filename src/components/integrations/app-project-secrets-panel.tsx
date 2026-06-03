"use client";

import * as React from "react";
import { Loader2, Shield, Trash2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { detectRequiredIntegrations } from "@/lib/generated-apps/integration-requirements";
import { INTEGRATION_PROVIDERS } from "@/lib/generated-apps/integration-registry";

type SecretRow = {
  key_name: string;
  provider?: string | null;
  status?: string | null;
  last_four?: string | null;
  updated_at?: string | null;
};

function secretStatus(row: SecretRow): "missing" | "saved" | "needs_update" {
  if (row.status === "needs_update") return "needs_update";
  if (row.last_four || row.status === "saved") return "saved";
  return "saved";
}

function guideForKey(keyName: string): string {
  for (const p of INTEGRATION_PROVIDERS) {
    const field = p.fields.find((f) => f.key === keyName);
    if (field) return field.guide;
  }
  return "Add this value from your provider dashboard. It is encrypted and never shown again.";
}

export function AppProjectSecretsPanel({
  projectId,
  appPrompt,
}: {
  projectId: string;
  appPrompt?: string;
}) {
  const [rows, setRows] = React.useState<SecretRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const requirements = React.useMemo(
    () => detectRequiredIntegrations(appPrompt ?? ""),
    [appPrompt],
  );

  const requiredKeyNames = React.useMemo(() => {
    const keys = new Set<string>();
    for (const r of requirements) {
      const prov = INTEGRATION_PROVIDERS.find((p) => p.id === r.provider);
      prov?.secretKeys.forEach((k) => keys.add(k));
    }
    return [...keys];
  }, [requirements]);

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

  const savedKeys = new Set(rows.map((r) => r.key_name));
  const displayKeys = [
    ...new Set([...requiredKeyNames, ...rows.map((r) => r.key_name)]),
  ].sort();

  async function saveKey(keyName: string, providerId: string) {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyName, value: draft.trim(), provider: providerId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success(`${keyName} saved securely`);
      setDraft("");
      setEditingKey(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(keyName: string) {
    if (!window.confirm(`Remove secret ${keyName}?`)) return;
    const res = await fetch(
      `/api/projects/${projectId}/secrets?key=${encodeURIComponent(keyName)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) {
      toast.error("Could not delete secret");
      return;
    }
    toast.success("Secret removed");
    await load();
  }

  function providerForKey(keyName: string): string {
    const row = rows.find((r) => r.key_name === keyName);
    if (row?.provider) return row.provider;
    const prov = INTEGRATION_PROVIDERS.find((p) => p.secretKeys.includes(keyName));
    return prov?.id ?? "custom";
  }

  return (
    <div className="space-y-4" data-testid="app-project-secrets-panel">
      <div className="flex items-start gap-2 rounded-xl bg-sky-500/5 px-3 py-2.5 ring-1 ring-sky-500/15">
        <Shield className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Only secrets you or the AI add appear here — not integration connections. Values are encrypted
          with <code className="text-[11px]">APP_SECRET_ENCRYPTION_KEY</code> and never shown again.
          Collaborators cannot view secret values.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : displayKeys.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          No secrets yet. Connect integrations or ask the AI to add required keys.
        </p>
      ) : (
        <ul className="space-y-2">
          {displayKeys.map((keyName) => {
            const row = rows.find((r) => r.key_name === keyName);
            const isMissing = !savedKeys.has(keyName);
            const status = isMissing ? "missing" : secretStatus(row ?? { key_name: keyName });
            return (
              <li
                key={keyName}
                className="rounded-xl bg-surface px-4 py-3 ring-1 ring-border"
                data-testid={`secret-row-${keyName}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-accent" />
                    <span className="font-mono text-[12px] font-semibold text-foreground">{keyName}</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                      status === "saved" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                      status === "missing" && "bg-amber-500/10 text-amber-800 dark:text-amber-200",
                      status === "needs_update" && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {status === "saved" ? "Saved" : status === "needs_update" ? "Needs update" : "Missing"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground" data-testid="secret-field-guide">
                  How to get this: {guideForKey(keyName)}
                </p>
                {row?.last_four ? (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">••••{row.last_four}</p>
                ) : null}
                {editingKey === keyName ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      autoComplete="off"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Paste value once"
                      className="flex-1 rounded-lg bg-background px-3 py-2 text-[13px] ring-1 ring-border"
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveKey(keyName, providerForKey(keyName))}
                      className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKey(keyName);
                        setDraft("");
                      }}
                      className="rounded-lg bg-muted/60 px-3 py-1.5 text-[12px] font-semibold text-foreground"
                    >
                      {isMissing ? "Add secret" : "Update"}
                    </button>
                    {!isMissing ? (
                      <button
                        type="button"
                        onClick={() => void deleteKey(keyName)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] text-destructive ring-1 ring-destructive/30"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
