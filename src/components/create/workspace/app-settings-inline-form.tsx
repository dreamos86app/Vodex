"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { notifyProjectCatalogUpdated } from "@/lib/projects/project-catalog-sync";

type AppSettingsInlineFormProps = {
  projectId: string;
  initialName: string;
  initialDescription: string;
  initialPublic: boolean;
  iconSrc: string;
  onSaved?: () => void;
};

export function AppSettingsInlineForm({
  projectId,
  initialName,
  initialDescription,
  initialPublic,
  iconSrc: initialIconSrc,
  onSaved,
}: AppSettingsInlineFormProps) {
  const [name, setName] = React.useState(initialName);
  const [description, setDescription] = React.useState(initialDescription);
  const [isPublic, setIsPublic] = React.useState(initialPublic);
  const [iconSrc, setIconSrc] = React.useState(initialIconSrc);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [regeneratingLogo, setRegeneratingLogo] = React.useState(false);
  const [logoCost, setLogoCost] = React.useState<number | null>(null);

  React.useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
    setIsPublic(initialPublic);
    setIconSrc(initialIconSrc);
  }, [initialName, initialDescription, initialPublic, initialIconSrc, projectId]);

  React.useEffect(() => {
    fetch(`/api/projects/${projectId}/identity/regenerate-logo`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { actionCredits?: number } | null) => {
        if (json?.actionCredits != null) setLogoCost(json.actionCredits);
      })
      .catch(() => undefined);
  }, [projectId]);

  async function handleRegenerateLogo() {
    const costLabel =
      logoCost != null ? `${logoCost} Action Credit${logoCost === 1 ? "" : "s"}` : "Action Credits";
    if (!window.confirm(`Regenerate app logo? This costs ${costLabel} and only charges on success.`)) return;
    setRegeneratingLogo(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/identity/regenerate-logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: true }),
      });
      const body = (await res.json()) as { error?: string; iconUrl?: string };
      if (!res.ok) throw new Error(body.error ?? "Logo regeneration failed");
      if (body.iconUrl) setIconSrc(`${body.iconUrl}?t=${Date.now()}`);
      toast.success("App logo regenerated");
      notifyProjectCatalogUpdated(projectId);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo regeneration failed");
    } finally {
      setRegeneratingLogo(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          app_name: name.trim(),
          short_description: description.trim(),
          is_public: isPublic,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save");
      setSaved(true);
      toast.success("App details saved");
      onSaved?.();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4" data-testid="app-settings-inline-form">
      <div className="flex items-start gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border">
          <Image src={iconSrc} alt="" width={56} height={56} className="size-full object-cover" unoptimized />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <button
            type="button"
            onClick={() => void handleRegenerateLogo()}
            disabled={regeneratingLogo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] font-medium text-foreground ring-1 ring-border hover:bg-muted disabled:opacity-50"
          >
            {regeneratingLogo ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Regenerate logo
            {logoCost != null ? ` (${logoCost} AC)` : null}
          </button>
          <div>
            <label htmlFor="app-settings-name" className="text-[11px] font-medium text-muted-foreground">
              App name
            </label>
            <input
              id="app-settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-background px-3 py-2 text-[13px] ring-1 ring-border focus:outline-none focus:ring-accent/40"
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="app-settings-desc" className="text-[11px] font-medium text-muted-foreground">
              Short description
            </label>
            <textarea
              id="app-settings-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-lg bg-background px-3 py-2 text-[13px] ring-1 ring-border focus:outline-none focus:ring-accent/40"
              maxLength={500}
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-foreground">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="size-4 rounded border-border"
            />
            List in community when published
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save changes
        </button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <CheckCircle2 className="size-3.5" />
            Saved
          </span>
        ) : null}
        {error ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="size-3.5" />
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
