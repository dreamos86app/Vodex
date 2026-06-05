"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, Smartphone, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const PHASE_LABELS: Record<string, string> = {
  reading_files: "Reading project files",
  checking_manifest: "Checking app manifest",
  checking_icons: "Checking icons",
  checking_splash: "Checking splash screens",
  checking_auth: "Checking auth setup",
  checking_privacy: "Checking privacy policy",
  checking_permissions: "Checking permissions",
  checking_play_store: "Checking Play Store requirements",
  checking_app_store: "Checking App Store requirements",
  checking_revenuecat: "Checking RevenueCat",
  checking_sha: "Checking SHA fingerprints",
  checking_package_id: "Checking package ID",
  checking_bundle: "Checking bundle readiness",
  complete: "Complete",
};

type Finding = { id: string; label: string; detail: string; severity: string };

export function MobileReadinessScanModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const [scanning, setScanning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [phase, setPhase] = React.useState<string | null>(null);
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [summary, setSummary] = React.useState<{ filesScanned?: number; issuesFound?: number; score?: number } | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (!open) return;
    void fetch(`/api/projects/${projectId}/readiness-scan`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        const running = json.running as { id: string; progress?: number; phase?: string } | null;
        if (running) {
          setScanning(true);
          setProgress(running.progress ?? 0);
          setPhase(running.phase ?? null);
          startPoll();
        }
      })
      .catch(() => null);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, projectId]);

  function startPoll() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void fetch(`/api/projects/${projectId}/readiness-scan`, { credentials: "include" })
        .then((r) => r.json())
        .then((json) => {
          const running = json.running as { progress?: number; phase?: string } | null;
          if (running) {
            setProgress(running.progress ?? 0);
            setPhase(running.phase ?? null);
          } else {
            setScanning(false);
            if (pollRef.current) clearInterval(pollRef.current);
            const latest = (json.scans as Array<Record<string, unknown>>)?.[0];
            if (latest?.status === "completed") {
              setFindings((latest.findings as Finding[]) ?? []);
              setSummary((latest.summary as typeof summary) ?? null);
              toast.success("Mobile readiness scan complete");
            }
          }
        })
        .catch(() => null);
    }, 2000);
  }

  async function runScan() {
    if (scanning) return;
    setScanning(true);
    setFindings([]);
    setSummary(null);
    setProgress(2);
    try {
      const res = await fetch(`/api/projects/${projectId}/readiness-scan`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: string;
        findings?: Finding[];
        summary?: { filesScanned: number; issuesFound: number; score: number };
      };
      if (res.status === 409) {
        toast.error("Scan already running");
        startPoll();
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      setFindings(json.findings ?? []);
      setSummary(json.summary ?? null);
      setProgress(100);
      setPhase("complete");
      toast.success("Scan complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
      setScanning(false);
    } finally {
      if (!pollRef.current) setScanning(false);
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
            className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-x-4 top-[8vh] z-[20001] mx-auto max-h-[84vh] w-full max-w-lg overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border sm:inset-x-auto"
            data-testid="mobile-readiness-scan-modal"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Smartphone className="size-5 text-accent" />
                <h2 className="text-[15px] font-semibold">Mobile readiness scan</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface">
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[calc(84vh-64px)] overflow-y-auto p-5">
              {!findings.length && !scanning ? (
                <p className="text-[12px] text-muted-foreground">
                  Scan your app for Play Store, App Store, icons, auth, and bundle requirements. You can close this modal — the scan continues in the background.
                </p>
              ) : null}

              {(scanning || progress > 0) && findings.length === 0 ? (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{phase ? PHASE_LABELS[phase] ?? phase : "Starting…"}</span>
                    <span className="font-semibold tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                    <motion.div
                      className="h-full bg-accent"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  {scanning ? (
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Scanning…
                    </p>
                  ) : null}
                </div>
              ) : null}

              {summary ? (
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-surface p-2 ring-1 ring-border">
                    <p className="text-[10px] text-muted-foreground">Score</p>
                    <p className="text-[16px] font-bold">{summary.score ?? "—"}</p>
                  </div>
                  <div className="rounded-xl bg-surface p-2 ring-1 ring-border">
                    <p className="text-[10px] text-muted-foreground">Files</p>
                    <p className="text-[16px] font-bold">{summary.filesScanned ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-surface p-2 ring-1 ring-border">
                    <p className="text-[10px] text-muted-foreground">Issues</p>
                    <p className="text-[16px] font-bold">{summary.issuesFound ?? 0}</p>
                  </div>
                </div>
              ) : null}

              {findings.length > 0 ? (
                <ul className="space-y-1.5">
                  {findings.map((f) => (
                    <li
                      key={f.id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-[11px] ring-1",
                        f.severity === "critical"
                          ? "bg-red-500/10 ring-red-500/25 text-red-900"
                          : f.severity === "high"
                            ? "bg-amber-500/10 ring-amber-500/25"
                            : "bg-muted/30 ring-border",
                      )}
                    >
                      <span className="font-semibold">{f.label}</span> — {f.detail}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => void runScan()}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {scanning ? "Scanning…" : findings.length ? "Rescan" : "Start scan"}
                </button>
                {findings.length > 0 ? (
                  <a
                    href={`/api/projects/${projectId}/mobile/readiness?format=json`}
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-[12px] ring-1 ring-border"
                  >
                    <Download className="size-3.5" /> JSON
                  </a>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
