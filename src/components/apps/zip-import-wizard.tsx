"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, CheckCircle2, AlertCircle, Loader2,
  FileCode2, Package,
  GitBranch, ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ZIP_IMPORT_MAX_MB } from "@/lib/import/zip-import-limits";

// ─── Detection types ──────────────────────────────────────────────────────────

interface DetectedItem {
  id: string;
  label: string;
  value: string;
  status: "detected" | "warning" | "missing";
  icon: React.ElementType;
}

type ZipCreditEstimate = {
  tier: number;
  baseCredits: number;
  multiplier: number;
  sizeBaseCredits: number;
  dependencyCount: number;
  dependencySurchargeCredits: number;
  estimatedActionCredits: number;
  estimatedFiles: number;
  estimatedSizeMb: number;
  framework: string;
  frameworkLabel: string;
};

interface ScanResult {
  framework: string;
  packageManager: string;
  detected: DetectedItem[];
  warnings: string[];
  estimatedRestore: string;
  creditEstimate?: ZipCreditEstimate | null;
  workerConnected?: boolean;
  workerUnavailableMessage?: string | null;
  scanStats?: {
    rawEntries: number;
    acceptedFiles: number;
    skippedIgnoredPaths: number;
    skippedBinary: number;
    scanProviderCostUsd: number;
  };
}

function scanResultFromImportApi(j: {
  fileCount: number;
  framework: string;
  frameworkLabel?: string;
  qualityScore?: number;
  routes?: string[];
  warnings?: string[];
  scanStats?: ScanResult["scanStats"];
}): ScanResult {
  const fwLabel = j.frameworkLabel ??
    (j.framework === "nextjs"
      ? "Next.js"
      : j.framework === "vite"
        ? "Vite / React"
        : j.framework === "react"
          ? "React"
          : j.framework === "static"
            ? "Static HTML"
            : "Unknown (generic)");

  const stats = j.scanStats;
  const skipped =
    stats != null ? stats.skippedIgnoredPaths + stats.skippedBinary : null;

  return {
    framework: fwLabel,
    packageManager: "npm",
    estimatedRestore: j.qualityScore != null && j.qualityScore >= 90 ? "Production-grade import" : "Complete — source is in Vodex",
    scanStats: stats,
    warnings: [
      ...(skipped != null && skipped > 0
        ? [`Imported safely. Skipped ${skipped} dependency, build, cache, or non-text files.`]
        : []),
      ...(j.warnings ?? []),
      ".env secrets are never imported from ZIP — add keys in Vodex settings.",
      "Scan uses deterministic analysis only — estimated AI cost: $0.00. Optional AI repair is quoted separately.",
    ].filter((w, i, arr) => arr.indexOf(w) === i),
    detected: [
      ...(stats
        ? [
            {
              id: "raw",
              label: "Files in archive",
              value: `${stats.rawEntries.toLocaleString()} entries scanned`,
              status: "detected" as const,
              icon: FileCode2,
            },
            {
              id: "accepted",
              label: "Source files accepted",
              value: `${stats.acceptedFiles.toLocaleString()} text sources`,
              status: "detected" as const,
              icon: CheckCircle2,
            },
            {
              id: "skipped",
              label: "Skipped (deps/cache/binary)",
              value: `${(stats.skippedIgnoredPaths + stats.skippedBinary).toLocaleString()} files`,
              status: "detected" as const,
              icon: AlertCircle,
            },
            {
              id: "scan-cost",
              label: "Scan cost",
              value: "Deterministic checks — no AI credits required ($0.00)",
              status: "detected" as const,
              icon: CheckCircle2,
            },
          ]
        : [
            {
              id: "scan-cost",
              label: "Scan cost",
              value: "Deterministic checks — no AI credits required ($0.00)",
              status: "detected" as const,
              icon: CheckCircle2,
            },
          ]),
      {
        id: "files",
        label: "Text sources saved",
        value: `${j.fileCount} files stored`,
        status: "detected",
        icon: FileCode2,
      },
      {
        id: "fw",
        label: "Framework",
        value: fwLabel,
        status: "detected",
        icon: Package,
      },
      {
        id: "quality",
        label: "Import quality",
        value: j.qualityScore != null ? `${j.qualityScore}/100` : "Scored after import",
        status: (j.qualityScore ?? 0) >= 85 ? "detected" : "warning",
        icon: GitBranch,
      },
      ...(j.routes?.length
        ? [{
            id: "routes",
            label: "Routes detected",
            value: `${j.routes.length} routes mapped`,
            status: "detected" as const,
            icon: GitBranch,
          }]
        : []),
    ],
  };
}

// ─── Pipeline step ────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

const PIPELINE: PipelineStep[] = [
  { id: "upload", label: "Uploading archive", status: "pending" },
  { id: "extract", label: "Extracting contents", status: "pending" },
  { id: "detect-framework", label: "Detecting framework", status: "pending" },
  { id: "detect-integrations", label: "Scanning integrations", status: "pending" },
  { id: "detect-routes", label: "Mapping routes & config", status: "pending" },
  { id: "restore", label: "Reconstructing project model", status: "pending" },
];

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-accent" />;
  if (status === "done") return <CheckCircle2 className="size-4 text-positive" strokeWidth={1.75} />;
  if (status === "error") return <AlertCircle className="size-4 text-destructive" strokeWidth={1.75} />;
  return <div className="size-4 rounded-full bg-border" />;
}

const STATUS_COLORS: Record<DetectedItem["status"], string> = {
  detected: "text-positive",
  warning: "text-amber-500",
  missing: "text-muted-foreground/50",
};

const STATUS_ICONS: Record<DetectedItem["status"], React.ElementType> = {
  detected: CheckCircle2,
  warning: AlertCircle,
  missing: X,
};

// ─── Main wizard ──────────────────────────────────────────────────────────────
// ZIP import flow version: P3.6 (cost confirmation, staged loading, preview redirect)

type WizardStep = "idle" | "scanning" | "confirm" | "importing" | "results" | "done";

interface ZipImportWizardProps {
  onClose: () => void;
  onComplete: (info: { projectId: string; name: string }) => void;
}

export function ZipImportWizard({ onClose, onComplete }: ZipImportWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<WizardStep>("idle");
  const [dragOver, setDragOver] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [pipeline, setPipeline] = React.useState<PipelineStep[]>(PIPELINE);
  const [scanResult, setScanResult] = React.useState<ScanResult | null>(null);
  const [importResult, setImportResult] = React.useState<{
    projectId: string;
    redirectTo: string;
    fileCount: number;
    framework: string;
    previewReady: boolean;
    blockedReason: string | null;
    previewStatus: string;
  } | null>(null);
  const [projectName, setProjectName] = React.useState("");
  const [importError, setImportError] = React.useState<Record<string, unknown> | null>(null);
  const [scanPayload, setScanPayload] = React.useState<{
    creditEstimate: ZipCreditEstimate;
    workerConnected: boolean;
    workerUnavailableMessage: string | null;
    actionCreditBalance: number;
    actionCreditsSufficient: boolean;
    actionCreditsRequired: number;
    fileCount: number;
    framework: string;
    frameworkLabel: string;
    qualityScore?: number;
    routes?: string[];
    warnings?: string[];
    scanStats?: ScanResult["scanStats"];
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importStageLabel, setImportStageLabel] = React.useState("");
  const [importElapsedSec, setImportElapsedSec] = React.useState(0);
  const importStartedAt = React.useRef<number | null>(null);

  const isDev = process.env.NODE_ENV !== "production";

  const IMPORT_STAGES: { pct: number; label: string }[] = [
    { pct: 10, label: "Uploading ZIP" },
    { pct: 25, label: "Scanning files" },
    { pct: 40, label: "Analyzing framework" },
    { pct: 55, label: "Preparing source snapshot" },
    { pct: 70, label: "Queueing preview worker" },
    { pct: 85, label: "Installing dependencies" },
    { pct: 95, label: "Building preview" },
    { pct: 100, label: "Finalizing preview" },
  ];

  React.useEffect(() => {
    if (step !== "importing") {
      importStartedAt.current = null;
      return;
    }
    importStartedAt.current = Date.now();
    setImportProgress(0);
    setImportElapsedSec(0);
    const tick = window.setInterval(() => {
      const started = importStartedAt.current ?? Date.now();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setImportElapsedSec(elapsed);
      const idx = Math.min(
        IMPORT_STAGES.length - 1,
        Math.floor(elapsed / 12),
      );
      const stage = IMPORT_STAGES[idx]!;
      setImportStageLabel(stage.label);
      const base = idx > 0 ? IMPORT_STAGES[idx - 1]!.pct : 0;
      const span = stage.pct - base;
      const within = Math.min(1, (elapsed % 12) / 12);
      setImportProgress(Math.min(98, Math.round(base + span * within)));
    }, 400);
    return () => window.clearInterval(tick);
  }, [step]);

  function copyImportDiagnostics(payload: Record<string, unknown>) {
    const text = JSON.stringify(payload, null, 2);
    void navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Import diagnostics copied");
  }

  function handleFile(f: File) {
    if (!f.name.endsWith(".zip")) {
      return;
    }
    if (f.size > ZIP_IMPORT_MAX_MB * 1024 * 1024) {
      toast.error(`ZIP is too large. Maximum size: ${ZIP_IMPORT_MAX_MB} MB`);
      return;
    }
    setFile(f);
    setProjectName(f.name.replace(".zip", ""));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function startScan() {
    if (!file) return;
    setStep("scanning");
    setImportError(null);
    const steps = PIPELINE.map((s) => ({ ...s, status: "pending" as const }));
    setPipeline(steps);

    const tick = async (idx: number, status: PipelineStep["status"]) => {
      setPipeline((prev) =>
        prev.map((s, i) => {
          if (i < idx) return { ...s, status: "done" };
          if (i === idx) return { ...s, status };
          return { ...s, status: "pending" };
        }),
      );
      await new Promise((r) => setTimeout(r, 120));
    };

    for (let i = 0; i < PIPELINE.length; i++) {
      await tick(i, "running");
    }

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/import/zip/preview", { method: "POST", body: fd });
    const j = (await res.json()) as {
      error?: string;
      code?: string;
      fileCount?: number;
      framework?: { id?: string; label?: string };
      qualityScore?: number;
      routes?: string[];
      warnings?: string[];
      scanStats?: ScanResult["scanStats"];
      creditEstimate?: ZipCreditEstimate;
      workerConnected?: boolean;
      workerUnavailableMessage?: string | null;
      actionCreditBalance?: number;
      actionCreditsSufficient?: boolean;
      actionCreditsRequired?: number;
    };

    if (!res.ok) {
      setPipeline((prev) =>
        prev.map((s, i) =>
          i === 0 ? { ...s, status: "error" } : { ...s, status: "pending" },
        ),
      );
      setImportError({ userMessage: j.error, code: j.code, status: res.status });
      toast.error(j.error ?? "ZIP scan failed");
      setStep("idle");
      return;
    }

    await tick(PIPELINE.length - 1, "done");
    setPipeline(PIPELINE.map((s) => ({ ...s, status: "done" as const })));

    if (!j.creditEstimate) {
      toast.error("Could not estimate preview Action Credits for this ZIP.");
      setStep("idle");
      return;
    }

    const fwId = j.framework?.id ?? "unknown";
    const fwLabel = j.framework?.label;
    const required = j.actionCreditsRequired ?? j.creditEstimate.estimatedActionCredits;
    const balance = j.actionCreditBalance ?? 0;
    setScanPayload({
      creditEstimate: j.creditEstimate,
      workerConnected: j.workerConnected === true,
      workerUnavailableMessage: j.workerUnavailableMessage ?? null,
      actionCreditBalance: balance,
      actionCreditsSufficient: j.actionCreditsSufficient === true || balance >= required,
      actionCreditsRequired: required,
      fileCount: j.fileCount ?? 0,
      framework: fwId,
      frameworkLabel: fwLabel ?? fwId,
      qualityScore: j.qualityScore,
      routes: j.routes,
      warnings: j.warnings,
      scanStats: j.scanStats,
    });
    setScanResult(
      scanResultFromImportApi({
        fileCount: j.fileCount ?? 0,
        framework: fwId,
        frameworkLabel: fwLabel,
        qualityScore: j.qualityScore,
        routes: j.routes,
        warnings: j.warnings,
        scanStats: j.scanStats,
      }),
    );
    if (j.creditEstimate) {
      setScanResult((prev) =>
        prev
          ? {
              ...prev,
              creditEstimate: j.creditEstimate,
              workerConnected: j.workerConnected,
              workerUnavailableMessage: j.workerUnavailableMessage,
            }
          : prev,
      );
    }
    setStep("confirm");
  }

  async function confirmImport() {
    if (!file || !scanPayload) return;
    if (!scanPayload.workerConnected) {
      toast.error(
        scanPayload.workerUnavailableMessage ??
          "Preview worker not connected. Start or deploy the worker before importing.",
      );
      return;
    }
    if (!scanPayload.actionCreditsSufficient) {
      toast.error("Not enough Action Credits for this ZIP preview build.");
      return;
    }
    setStep("importing");
    setImportError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (projectName.trim()) fd.append("name", projectName.trim());
    const res = await fetch("/api/projects/import-zip", { method: "POST", body: fd });
    const j = (await res.json()) as {
      error?: string;
      devError?: string;
      code?: string;
      hint?: string;
      adminDetail?: Record<string, unknown>;
      fileCount?: number;
      framework?: string;
      frameworkLabel?: string;
      projectId?: string;
      redirectTo?: string;
      previewReady?: boolean;
      blockedReason?: string | null;
      previewStatus?: string;
    };
    if (!res.ok) {
      const diagnostics = {
        step: (j.adminDetail as { step?: string } | undefined)?.step ?? "unknown",
        code: j.code,
        userMessage: j.error,
        devError: j.devError ?? j.hint ?? j.error,
        adminDetail: j.adminDetail,
        status: res.status,
      };
      setImportError(diagnostics);
      if (j.code === "insufficient_action_credits" || res.status === 402) {
        toast.error(j.error ?? "Not enough Action Credits for this ZIP preview.");
        setScanPayload((prev) =>
          prev ? { ...prev, actionCreditsSufficient: false } : prev,
        );
      } else {
        toast.error(j.error ?? "Import failed");
      }
      setStep("confirm");
      return;
    }
    const result = {
      projectId: j.projectId!,
      redirectTo: j.redirectTo!,
      fileCount: j.fileCount ?? 0,
      framework: j.framework ?? scanPayload.framework,
      previewReady: j.previewReady === true,
      blockedReason: j.blockedReason ?? null,
      previewStatus: j.previewStatus ?? "queued",
    };
    setImportProgress(100);
    setImportResult(result);
    if (result.redirectTo && !result.previewReady) {
      setStep("done");
      const name = projectName || file?.name.replace(/\.zip$/i, "") || "Imported";
      onComplete({ projectId: result.projectId, name });
      router.push(result.redirectTo);
      return;
    }
    setStep("results");
  }

  function handleClose() {
    if (step === "importing") {
      toast.success("Preview build continues in the background. Check your project card for status.");
    }
    onClose();
  }

  function handleOpen() {
    if (!importResult?.redirectTo) return;
    const name = projectName || file?.name.replace(/\.zip$/i, "") || "Imported";
    setStep("done");
    setTimeout(() => {
      onComplete({ projectId: importResult.projectId, name });
      router.push(importResult.redirectTo);
    }, 450);
  }

  return (
    <div className="fixed inset-0 z-[80] flex min-h-[100dvh] items-center justify-center bg-black/55 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[min(92dvh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-xl)] bg-background shadow-2xl ring-1 ring-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-[15px] font-semibold text-foreground">Import ZIP</p>
            <p className="text-[12px] text-muted-foreground">Restore an existing project into Vodex</p>
          </div>
          <button
            onClick={handleClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground transition"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Upload */}
            {step === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-[var(--radius-xl)] border-2 border-dashed py-14 transition",
                    dragOver
                      ? "border-accent bg-accent/5"
                      : file
                        ? "border-positive/40 bg-positive/5"
                        : "border-border hover:border-accent/40 hover:bg-surface/50",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                  <div className={cn("flex size-14 items-center justify-center rounded-full", file ? "bg-positive/10" : "bg-accent/10")}>
                    {file
                      ? <CheckCircle2 className="size-7 text-positive" strokeWidth={1.5} />
                      : <Upload className="size-7 text-accent" strokeWidth={1.5} />
                    }
                  </div>
                  {file ? (
                    <div className="text-center">
                      <p className="text-[14px] font-semibold text-foreground">{file.name}</p>
                      <p className="text-[12px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · ready to scan</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[14px] font-medium text-foreground">Drop your ZIP here</p>
                      <p className="text-[12px] text-muted-foreground">
                        or click to browse · maximum size: {ZIP_IMPORT_MAX_MB} MB
                      </p>
                    </div>
                  )}
                </div>

                {file && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-foreground">Project name</label>
                    <input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="h-9 w-full rounded-[var(--radius-md)] bg-surface px-3 text-[13px] text-foreground ring-1 ring-border outline-none focus:ring-accent/40"
                      placeholder="My imported app"
                    />
                  </div>
                )}

                {importError && (
                  <div className="space-y-2 rounded-lg bg-destructive/8 px-3 py-3 ring-1 ring-destructive/20">
                    <p className="text-[12px] font-medium text-destructive">Import failed</p>
                    <p className="text-[11px] text-muted-foreground break-words">
                      {String(importError.devError ?? importError.userMessage ?? "Unknown error")}
                    </p>
                    {isDev && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copyImportDiagnostics(importError)}
                        >
                          Copy import diagnostics
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                  <Button variant="accent" size="sm" disabled={!file} onClick={startScan}>
                    Scan ZIP
                    <ChevronRight className="size-3.5" strokeWidth={2} />
                  </Button>
                </div>

                <p className="text-center text-[11px] text-muted-foreground">
                  Scan is free. Preview build uses Action Credits after you confirm. Exclude{" "}
                  <code className="font-mono">node_modules</code> and{" "}
                  <code className="font-mono">.next</code> from your ZIP for best results.
                </p>
              </motion.div>
            )}

            {/* Step 2: Scanning */}
            {step === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 rounded-lg bg-accent/8 px-4 py-3">
                  <Loader2 className="size-4 animate-spin text-accent" />
                  <p className="text-[13px] font-medium text-foreground">
                    Scanning <span className="text-accent">{file?.name}</span>…
                  </p>
                </div>

                <div className="space-y-2 rounded-[var(--radius-xl)] bg-surface p-4 ring-1 ring-border">
                  {pipeline.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-1">
                      <StepIcon status={s.status} />
                      <p className={cn(
                        "text-[12.5px] transition",
                        s.status === "done" ? "text-foreground" : s.status === "running" ? "text-foreground font-medium" : "text-muted-foreground/50",
                      )}>
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Preview build summary (required before import/build) */}
            {step === "confirm" && scanResult && scanPayload && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="rounded-xl bg-accent/8 p-4 ring-1 ring-accent/25 space-y-4">
                  <div>
                    <p className="text-[16px] font-semibold text-foreground">Preview Build Summary</p>
                    <p className="text-[12px] font-medium text-muted-foreground">Estimated Preview Cost</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      ZIP scan is complete and free. Review cost below before starting the preview build.
                    </p>
                  </div>

                  <dl className="grid gap-2.5 text-[12px] sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Framework</dt>
                      <dd className="font-medium text-foreground">{scanPayload.creditEstimate.frameworkLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Files</dt>
                      <dd className="font-medium text-foreground">
                        {scanPayload.creditEstimate.estimatedFiles.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">ZIP size</dt>
                      <dd className="font-medium text-foreground">{scanPayload.creditEstimate.estimatedSizeMb} MB</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Estimated preview cost</dt>
                      <dd className="font-semibold text-foreground tabular-nums">
                        {scanPayload.creditEstimate.estimatedActionCredits} Action Credits
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Your balance</dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {scanPayload.actionCreditBalance.toLocaleString()} Action Credits
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Preview worker</dt>
                      <dd
                        className={cn(
                          "font-medium",
                          scanPayload.workerConnected ? "text-positive" : "text-destructive",
                        )}
                      >
                        {scanPayload.workerConnected ? "Ready" : "Not connected"}
                      </dd>
                    </div>
                  </dl>

                  {scanPayload.creditEstimate.dependencySurchargeCredits > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Includes +{scanPayload.creditEstimate.dependencySurchargeCredits} AC for large dependency
                      graph ({scanPayload.creditEstimate.dependencyCount} packages).
                    </p>
                  ) : null}

                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-950 dark:text-amber-100 space-y-2">
                    <p className="font-semibold">We are NOT charging Action Credits yet.</p>
                    <p className="leading-relaxed text-amber-900/90 dark:text-amber-100/90">
                      Action Credits are only charged after you click &quot;Build Preview&quot; and the preview build
                      successfully completes on the worker. Scanning this ZIP is always free.
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-[11px] text-amber-900/80 dark:text-amber-100/80">
                      <li>If the preview fails before the build starts, no credits are charged.</li>
                      <li>If you cancel before the build runs, no credits are charged.</li>
                      <li>If the preview never becomes renderable, existing refund rules apply.</li>
                    </ul>
                  </div>

                  {!scanPayload.actionCreditsSufficient ? (
                    <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive ring-1 ring-destructive/20 space-y-2">
                      <p>
                        You need{" "}
                        {Math.max(
                          0,
                          scanPayload.actionCreditsRequired - scanPayload.actionCreditBalance,
                        ).toLocaleString()}{" "}
                        more Action Credits.
                      </p>
                      <Button variant="accent" size="sm" asChild>
                        <Link href="/credits">Buy Credits</Link>
                      </Button>
                    </div>
                  ) : null}
                  {!scanPayload.workerConnected ? (
                    <div className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive ring-1 ring-destructive/20">
                      {scanPayload.workerUnavailableMessage ??
                        "Preview worker must be connected before you can build a preview."}
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setStep("idle")}>
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    size="sm"
                    className="gap-1.5"
                    disabled={!scanPayload.workerConnected || !scanPayload.actionCreditsSufficient}
                    onClick={() => void confirmImport()}
                  >
                    Build Preview ({scanPayload.creditEstimate.estimatedActionCredits} AC)
                    <ChevronRight className="size-3.5" strokeWidth={2} />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Importing */}
            {step === "importing" && (
              <motion.div
                key="importing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 py-10"
              >
                <Loader2 className="size-8 animate-spin text-accent" />
                <p className="text-[14px] font-medium text-foreground">{importStageLabel || "Importing…"}</p>
                <div className="w-full max-w-md">
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-[12px] text-muted-foreground">
                    {importProgress}% · {importElapsedSec}s elapsed
                    {file ? ` · ${(file.size / (1024 * 1024)).toFixed(1)} MB` : ""}
                  </p>
                </div>
                <p className="max-w-md text-center text-[12px] text-muted-foreground">
                  Credits are currently <strong>reserved</strong>, not charged. We capture Action Credits only if the
                  preview build succeeds. Large imported apps can take a few minutes.
                </p>
              </motion.div>
            )}

            {/* Step 5: Results */}
            {step === "results" && scanResult && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none"
              >
                {/* Summary */}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 ring-1",
                    importResult?.previewReady
                      ? "bg-positive/8 ring-positive/20"
                      : scanPayload?.workerConnected
                        ? "bg-accent/8 ring-accent/20"
                        : "bg-destructive/8 ring-destructive/20",
                  )}
                >
                  {importResult?.previewReady ? (
                    <CheckCircle2 className="size-4 text-positive" strokeWidth={1.75} />
                  ) : scanPayload?.workerConnected ? (
                    <CheckCircle2 className="size-4 text-accent" strokeWidth={1.75} />
                  ) : (
                    <AlertCircle className="size-4 text-destructive" strokeWidth={1.75} />
                  )}
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      {importResult
                        ? importResult.previewReady
                          ? `Preview ready — ${scanResult.framework}`
                          : importResult.previewStatus === "queued"
                            ? `Imported — preview queued (${scanResult.framework})`
                            : `Imported — ${scanResult.framework}`
                        : `Scan complete — ${scanResult.framework}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {importResult
                        ? importResult.previewReady
                          ? "Runnable preview validated."
                          : importResult.previewStatus === "queued"
                            ? "Preview build queued for the dedicated worker."
                            : (importResult.blockedReason ?? "Review build logs in the dashboard.")
                        : "Import complete."}
                    </p>
                  </div>
                </div>

                {/* Detected technologies */}
                <div className="rounded-[var(--radius-xl)] bg-surface ring-1 ring-border overflow-hidden">
                  <div className="border-b border-border px-4 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Detected</p>
                  </div>
                  <div className="divide-y divide-border/60 px-1">
                    {scanResult.detected.map((item) => {
                      const StatusIcon = STATUS_ICONS[item.status];
                      const ItemIcon = item.icon;
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                          <ItemIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-foreground">{item.label}</p>
                            <p className={cn("text-[11px]", STATUS_COLORS[item.status])}>{item.value}</p>
                          </div>
                          <StatusIcon className={cn("size-3.5 shrink-0", STATUS_COLORS[item.status])} strokeWidth={1.75} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Warnings */}
                {scanResult.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {scanResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/8 px-3 py-2 text-[12px] text-amber-600 ring-1 ring-amber-500/15 dark:text-amber-400">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setStep("idle")}>
                    Start over
                  </Button>
                  {importResult ? (
                    <Button variant="accent" size="sm" onClick={handleOpen} className="gap-1.5">
                      Open in workspace
                      <ExternalLink className="size-3.5" strokeWidth={2} />
                    </Button>
                  ) : (
                    <Button variant="accent" size="sm" onClick={() => setStep("confirm")}>
                      Back to confirmation
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 4: Done */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-10 text-center"
              >
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-positive/10 ring-1 ring-positive/20">
                  <CheckCircle2 className="size-8 text-positive" strokeWidth={1.75} />
                </div>
                <p className="text-[16px] font-semibold text-foreground">Project restored</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Opening <strong>{projectName}</strong> in your workspace…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
