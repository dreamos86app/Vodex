"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Flag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/lib/stores/auth-store";
import { profileDisplayName } from "@/lib/community/profile-display-name";

const REASONS = [
  { id: "spam", label: "Spam or scam" },
  { id: "harassment", label: "Harassment or abuse" },
  { id: "impersonation", label: "Impersonation" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "other", label: "Other" },
] as const;

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "profile" | "group" | "discussion" | "message";
  targetId: string;
  targetLabel: string;
}) {
  const { user, profile } = useAuthStore();
  const [reason, setReason] = React.useState<string>("spam");
  const [details, setDetails] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setReason("spam");
      setDetails("");
    }
  }, [open]);

  async function submit() {
    if (!user) {
      toast.error("Sign in to send a report");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/community/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          targetLabel,
          reason,
          details: details.trim(),
          reporterName: profileDisplayName(profile, user.email ?? "Member"),
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Report failed");
      toast.success("Report submitted — our team will review it");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setSending(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1700] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-accent/25"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Flag className="size-4" />
            </div>
            <p className="text-[14px] font-semibold">Report {targetLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Reason</p>
            <div className="mt-2 grid gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`rounded-xl px-3 py-2 text-left text-[12px] ring-1 transition ${
                    reason === r.id ? "bg-accent/10 text-accent ring-accent/30" : "ring-border hover:bg-muted/40"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-[12px] font-medium text-muted-foreground">
            Additional details
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Tell us what happened…"
              className="mt-1.5 w-full rounded-xl bg-surface px-3 py-2.5 text-[13px] ring-1 ring-border"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={() => void submit()} disabled={sending}>
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : "Submit report"}
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
