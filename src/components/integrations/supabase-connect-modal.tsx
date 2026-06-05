"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Loader2, X } from "lucide-react";
import { IntegrationIconWell } from "@/components/brand/integration-icons";
import { toast } from "@/lib/toast";

export function SupabaseConnectModal({
  open,
  onClose,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  onLinked?: (projects: Array<{ ref: string; name: string }>) => void;
}) {
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  React.useEffect(() => {
    if (!open) {
      setToken("");
      setStep(1);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    if (!token.trim()) {
      toast.error("Paste your Supabase access token");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/supabase/user/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken: token.trim() }),
      });
      const json = (await res.json()) as {
        error?: string;
        projects?: Array<{ ref: string; name: string }>;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not link Supabase");
      toast.success("Supabase account linked");
      setStep(3);
      onLinked?.(json.projects ?? []);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[20000] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="fixed left-1/2 top-[10vh] z-[20001] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border"
            data-testid="supabase-connect-modal"
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <IntegrationIconWell provider="supabase" className="size-11" />
                <div>
                  <h2 className="text-[16px] font-semibold">Connect Supabase</h2>
                  <p className="text-[12px] text-muted-foreground">Step {step} of 3</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <ol className="space-y-2 text-[12px] text-muted-foreground">
                <li className={step >= 1 ? "text-foreground" : ""}>1. Create a token in Supabase dashboard</li>
                <li className={step >= 2 ? "text-foreground" : ""}>2. Paste token below (never stored in browser)</li>
                <li className={step >= 3 ? "text-foreground" : ""}>3. Pick your project for this app</li>
              </ol>

              <a
                href="https://supabase.com/dashboard/account/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent"
              >
                Open Supabase tokens
                <ExternalLink className="size-3" />
              </a>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Access token
                </span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setStep(2);
                  }}
                  placeholder="sbp_..."
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>

              <p className="rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Vodex encrypts your token server-side. We only use it to list projects and configure your app database.
              </p>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] ring-1 ring-border">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || !token.trim()}
                  onClick={() => void submit()}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Connect Supabase
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
