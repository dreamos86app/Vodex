"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Loader2, X } from "lucide-react";
import { IntegrationIconWell } from "@/components/brand/integration-icons";
import { SupabaseConnectModal } from "@/components/integrations/supabase-connect-modal";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export type IntegrationPreset = "supabase" | "github";

/** Builder top-right integration modal — same polished flow as dashboard. */
export function WorkspaceIntegrationsModal({
  open,
  onClose,
  preset,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  preset: IntegrationPreset;
  projectId: string | null;
}) {
  const [showSupabaseModal, setShowSupabaseModal] = React.useState(false);
  const [githubBusy, setGithubBusy] = React.useState(false);

  React.useEffect(() => {
    if (open && preset === "supabase" && projectId) {
      setShowSupabaseModal(true);
    }
  }, [open, preset, projectId]);

  async function connectGithub() {
    if (!projectId) return;
    setGithubBusy(true);
    try {
      const res = await fetch(`/api/integrations/github/connect?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Could not start GitHub OAuth");
      window.location.href = json.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "GitHub connect failed");
    } finally {
      setGithubBusy(false);
    }
  }

  const title = preset === "supabase" ? "Connect Supabase" : "Connect GitHub";

  return (
    <>
      <AnimatePresence>
        {open && preset === "github" && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10001] bg-black/40 backdrop-blur-[2px]"
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className={cn(
                "fixed left-1/2 top-[12vh] z-[10002] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2",
                "overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border",
              )}
              data-testid="workspace-github-connect-modal"
            >
              <div className="flex items-start justify-between border-b border-border px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <IntegrationIconWell provider="github" className="size-10" />
                  <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
                </div>
                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                {!projectId ? (
                  <p className="text-[13px] text-muted-foreground">
                    Create or open an app first to connect GitHub.
                  </p>
                ) : (
                  <>
                    <p className="text-[12px] text-muted-foreground">
                      Authorize Vodex to access your repositories. Keys are encrypted server-side.
                    </p>
                    <button
                      type="button"
                      disabled={githubBusy}
                      onClick={() => void connectGithub()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                    >
                      {githubBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                      Continue with GitHub
                      <ExternalLink className="size-3.5 opacity-80" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SupabaseConnectModal
        open={open && preset === "supabase" && showSupabaseModal}
        onClose={() => {
          setShowSupabaseModal(false);
          onClose();
        }}
        onLinked={() => {
          toast.success("Supabase linked — select a project in Integrations");
          setShowSupabaseModal(false);
          onClose();
        }}
      />
    </>
  );
}
