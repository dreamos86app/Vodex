"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { MARKETING_EMAIL_TEMPLATES } from "@/lib/email/marketing-email-templates";

type TargetPlan = "all_opted_in" | "free" | "starter" | "pro" | "infinity";

export function AdminEmailMarketingPanel() {
  const [templateId, setTemplateId] = React.useState<typeof MARKETING_EMAIL_TEMPLATES[number]["id"]>("welcome");
  const [targetPlan, setTargetPlan] = React.useState<TargetPlan>("all_opted_in");
  const [targetEmail, setTargetEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const template = MARKETING_EMAIL_TEMPLATES.find((t) => t.id === templateId)!;

  async function send(testOnly: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email-marketing/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateId,
          targetPlan: targetEmail.trim() ? undefined : targetPlan,
          targetEmail: targetEmail.trim() || undefined,
          testOnly,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      toast.success(
        testOnly
          ? `Test email attempted (${json.sent}/${json.attempted})`
          : `Campaign sent to ${json.sent} recipient(s)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4" data-testid="admin-email-marketing">
      <h3 className="text-[14px] font-semibold">Email marketing (Resend)</h3>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Gmail/product emails only — separate from in-app inbox. Only users with marketing opt-in receive
        campaigns. Requires RESEND_API_KEY and EMAIL_FROM on the server.
      </p>
      <div className="mt-4 space-y-3">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value as typeof templateId)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
        >
          {MARKETING_EMAIL_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={targetPlan}
          onChange={(e) => setTargetPlan(e.target.value as TargetPlan)}
          disabled={Boolean(targetEmail.trim())}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] disabled:opacity-50"
        >
          <option value="all_opted_in">All marketing opt-in users</option>
          <option value="free">Free (opted in)</option>
          <option value="starter">Starter (opted in)</option>
          <option value="pro">Pro (opted in)</option>
          <option value="infinity">Infinity (opted in)</option>
        </select>
        <input
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
          placeholder="Specific email for test or single send"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
        />
        <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">{template.subject}</p>
          <p className="mt-1">{template.preheader}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !targetEmail.trim()}
            onClick={() => void send(true)}
            className="rounded-lg border border-border px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
          >
            Send test email
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(false)}
            className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Send campaign
          </button>
        </div>
      </div>
    </div>
  );
}
