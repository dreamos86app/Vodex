"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  X,
  Globe,
  Smartphone,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Apple,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlaceholderRepairCard, type PlaceholderFindingUi } from "@/components/publish/placeholder-repair-card";
import { PublishSuccessOverlay } from "@/components/publish/publish-success-overlay";
import { fetchDedupe, getCached, invalidateCache } from "@/lib/cache/fetch-dedupe";
import { toast } from "@/lib/toast";

export type PublishTargetId = "web" | "custom_domain" | "android_apk" | "android_aab";

export type PublishUiState = {
  web?: { note?: string; saved?: boolean };
  custom_domain?: { domain?: string; saved?: boolean };
  android_apk?: { requested?: boolean; saved?: boolean };
  android_aab?: { requested?: boolean; saved?: boolean };
  /** ISO 8601 */
  updated_at?: string;
};

type PublishApiPayload = {
  projectId?: string;
  subdomain: string | null;
  publicWebUrl: string | null;
  customDomainAllowed: boolean;
  platformBaseDomain?: string;
  error?: string;
};

type ReadinessPayload = {
  issues?: Array<{ severity: string; title?: string; detail?: string; code?: string; message?: string }>;
  fileCount: number;
  canPublishWeb?: boolean;
  artifactsReady?: boolean;
  blockers?: string[];
  buildStatus?: string | null;
  buildCompleted?: boolean;
  appName?: string | null;
  placeholderFindings?: PlaceholderFindingUi[];
  isZipImport?: boolean;
  error?: string;
};

type WrapJob = {
  id?: string;
  status?: string;
  error_message?: string | null;
  kind?: string;
};

import { getEntitlements } from "@/lib/billing/plan-entitlements";

export type PublishUiPhase =
  | "idle"
  | "preparing"
  | "allocating"
  | "building"
  | "finalizing"
  | "published"
  | "failed";

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  planId: string | undefined;
  initialDraft: PublishUiState | null;
  onSaved: (draft: PublishUiState) => void;
  /** False until the app has a preview URL or icon — web publish stays honestly locked. */
  artifactsReady?: boolean;
  onPublishPhaseChange?: (phase: PublishUiPhase, detail?: { url?: string; error?: string }) => void;
}

export function PublishModal({
  open,
  onClose,
  projectId,
  planId,
  initialDraft,
  onSaved,
  artifactsReady = true,
  onPublishPhaseChange,
}: PublishModalProps) {
  const [tab, setTab] = React.useState<"web" | "mobile">("web");
  const [publishInfo, setPublishInfo] = React.useState<PublishApiPayload | null>(null);
  const [readiness, setReadiness] = React.useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const [publishPhase, setPublishPhase] = React.useState<PublishUiPhase>("idle");
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const publishInFlightRef = React.useRef(false);
  const [wrapBusy, setWrapBusy] = React.useState<null | "android_apk" | "android_aab">(null);
  const [lastWrapJob, setLastWrapJob] = React.useState<WrapJob | null>(null);
  const [local, setLocal] = React.useState<PublishUiState>(initialDraft ?? {});
  const localRef = React.useRef(local);
  localRef.current = local;
  const [mobilePlatform, setMobilePlatform] = React.useState<"ios" | "android">("android");
  const [publishSuccessUrl, setPublishSuccessUrl] = React.useState<string | null>(null);
  const [successOverlayOpen, setSuccessOverlayOpen] = React.useState(false);
  const [mobileGatePassed, setMobileGatePassed] = React.useState(false);
  const [mobileScanning, setMobileScanning] = React.useState(false);

  React.useEffect(() => {
    if (open && initialDraft) setLocal(initialDraft);
  }, [open, initialDraft]);

  React.useEffect(() => {
    if (!open || !projectId) {
      setPublishInfo(null);
      setReadiness(null);
      setLastWrapJob(null);
      setPublishSuccessUrl(null);
      setMobileGatePassed(false);
      return;
    }
    let cancelled = false;
    const cached = getCached<ReadinessPayload>(`publish-readiness:${projectId}`, 20_000);
    if (cached) {
      setReadiness(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void (async () => {
      try {
        const [pub, ready] = await Promise.all([
          fetchDedupe(`publish-info:${projectId}`, (signal) =>
            fetch(`/api/projects/${projectId}/publish`, { credentials: "include", signal }).then((r) =>
              r.json(),
            ),
          ),
          fetchDedupe(`publish-readiness:${projectId}`, (signal) =>
            fetch(`/api/projects/${projectId}/publish/readiness`, { credentials: "include", signal }).then(
              (r) => r.json(),
            ),
          ),
        ]);
        if (cancelled) return;
        setPublishInfo(pub as PublishApiPayload);
        setReadiness(ready as ReadinessPayload);
      } catch {
        if (!cancelled) toast.error("Could not load publish data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  async function refreshPublishAfterAllocate(next: PublishApiPayload) {
    setPublishInfo(next);
    const merged: PublishUiState = {
      ...localRef.current,
      web: { ...localRef.current.web, saved: true, note: "subdomain_allocated" },
      updated_at: new Date().toISOString(),
    };
    setLocal(merged);
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ publish_ui: merged }),
      });
      onSaved(merged);
    } catch {
      /* best-effort */
    }
  }

  const setPhase = React.useCallback(
    (phase: PublishUiPhase, detail?: { url?: string; error?: string }) => {
      setPublishPhase(phase);
      onPublishPhaseChange?.(phase, detail);
    },
    [onPublishPhaseChange],
  );

  async function ensureWebPublish() {
    if (!projectId) {
      toast.error("Save your app first.");
      return;
    }
    if (publishInFlightRef.current) {
      toast.info("Publish already in progress…");
      return;
    }
    publishInFlightRef.current = true;
    setPosting(true);
    setPublishError(null);
    setPhase("preparing");
    try {
      setPhase("allocating");
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        code?: string;
      };
      if (!res.ok) {
        const msg = body.message ?? body.error ?? body.code ?? "Publish failed";
        throw new Error(msg);
      }
      setPhase("building");
      const verifyRes = await fetch(`/api/projects/${projectId}/publish`, { credentials: "include" });
      const next = (await verifyRes.json()) as PublishApiPayload;
      setPhase("finalizing");
      await refreshPublishAfterAllocate(next);
      const liveUrl = next.publicWebUrl ?? null;
      setPhase("published", { url: liveUrl ?? undefined });
      if (liveUrl) {
        setPublishSuccessUrl(liveUrl);
        setSuccessOverlayOpen(true);
        onClose();
      }
      toast.success("Your app is live!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      setPublishError(msg);
      setPhase("failed", { error: msg });
      toast.error(msg);
    } finally {
      setPosting(false);
      publishInFlightRef.current = false;
    }
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Copied"),
      () => toast.error("Could not copy"),
    );
  }

  async function requestWrap(kind: "android_apk" | "android_aab") {
    if (!projectId) return;
    setWrapBusy(kind);
    setLastWrapJob(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/wrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kind }),
      });
      const j = (await res.json()) as { job?: WrapJob; error?: string; locked?: boolean };
      if (!res.ok) {
        toast.error(j.error ?? "Request failed");
        return;
      }
      if (!j.job) {
        toast.error("No job returned");
        return;
      }
      setLastWrapJob(j.job);
      if (j.job.status === "requires_builder_config") {
        toast.info(j.job.error_message ?? "Mobile builder is not configured on the server.");
      } else {
        toast.success("Build job recorded.");
      }
      const patchKey = kind === "android_apk" ? "android_apk" : "android_aab";
      const merged: PublishUiState = {
        ...localRef.current,
        [patchKey]: { requested: true, saved: true },
        updated_at: new Date().toISOString(),
      };
      setLocal(merged);
      onSaved(merged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start build");
    } finally {
      setWrapBusy(null);
    }
  }

  const androidLocked = !getEntitlements(planId).canUseMobileWrapping;
  const iosLocked = !getEntitlements(planId).canUseMobileWrapping;
  const isZipImport = Boolean(readiness?.isZipImport);
  const publicUrl = publishInfo?.publicWebUrl ?? null;
  const customAllowed = getEntitlements(planId).canUseCustomDomain;
  const canPublish = Boolean(readiness?.canPublishWeb ?? readiness?.artifactsReady);
  const webPublishLocked = !projectId || (!canPublish && !artifactsReady);
  const publishBlockerLabel =
    readiness?.blockers?.find((b) => !b.includes("placeholder_content:")) ??
    (readiness?.placeholderFindings?.length
      ? "Placeholder content found — fix before publish"
      : readiness?.fileCount === 0 && readiness?.buildStatus === "completed"
        ? "Build saved no files — check build logs"
        : !readiness?.buildCompleted
          ? "Finish a successful build first"
          : "Complete build requirements to publish");

  async function runMobileEligibilityScan() {
    if (!projectId) return;
    setMobileScanning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/mobile/readiness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { gatePassed?: boolean; blockers?: string[]; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Scan failed");
        return;
      }
      setMobileGatePassed(Boolean(json.gatePassed));
      if (json.gatePassed) {
        toast.success("Mobile eligibility passed");
      } else {
        toast.error(
          json.blockers?.length
            ? `Fix blockers: ${json.blockers.slice(0, 3).join(", ")}`
            : "Open Mobile App tab to fix blockers",
        );
      }
      refreshReadiness();
    } finally {
      setMobileScanning(false);
    }
  }

  function refreshReadiness() {
    if (!projectId) return;
    invalidateCache(`publish-readiness:${projectId}`);
    setLoading(true);
    void fetchDedupe(
      `publish-readiness:${projectId}`,
      (signal) =>
        fetch(`/api/projects/${projectId}/publish/readiness`, { credentials: "include", signal }).then((r) =>
          r.json(),
        ),
      { force: true },
    )
      .then((ready) => setReadiness(ready as ReadinessPayload))
      .finally(() => setLoading(false));
  }

  const subdomainLiveUrl =
    publishInfo?.subdomain && publishInfo?.platformBaseDomain
      ? `https://${publishInfo.subdomain}.${publishInfo.platformBaseDomain}`
      : null;

  return (
    <>
      <PublishSuccessOverlay
        open={successOverlayOpen && Boolean(publishSuccessUrl)}
        appName={readiness?.appName ?? "Your app"}
        publicUrl={publishSuccessUrl ?? ""}
        subdomainUrl={subdomainLiveUrl}
        customDomainHint={customAllowed ? undefined : "Upgrade to connect a custom domain."}
        onDone={() => {
          setSuccessOverlayOpen(false);
          setPublishSuccessUrl(null);
        }}
      />
      {!open || typeof document === "undefined" ? null : createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-end justify-center bg-foreground/25 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[min(92dvh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-xl)] bg-background shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>

        <div className="border-b border-border bg-gradient-to-r from-accent/[0.1] via-background to-violet-500/[0.06] px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent/12 ring-1 ring-accent/20">
            <Rocket className="size-5 text-accent" strokeWidth={1.65} />
          </div>
          <h2 id="publish-title" className="mt-3 text-[18px] font-semibold tracking-tight text-foreground">
            Publish
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Vodex hosts the web version for you at a dedicated subdomain. Mobile packaging uses the same project files
            — availability depends on your plan and the platform builder.
          </p>

          {!artifactsReady && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-100">
              <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                {loading && !readiness ? (
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-amber-500/20" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-amber-500/15" />
                  </div>
                ) : (
                  <>
                    <p>Web publish is not ready yet.</p>
                    {readiness?.blockers && readiness.blockers.length > 0 && (
                      <ul className="mt-1.5 list-inside list-disc text-[11px]">
                        {readiness.blockers
                          .filter((b) => !b.includes("placeholder_content:"))
                          .slice(0, 4)
                          .map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                      </ul>
                    )}
                    {readiness?.fileCount != null && (
                      <p className="mt-1 text-[11px] opacity-80">{readiness.fileCount} app file(s)</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {readiness?.placeholderFindings &&
            readiness.placeholderFindings.length > 0 &&
            projectId &&
            !isZipImport ? (
            <PlaceholderRepairCard
              projectId={projectId}
              findings={readiness.placeholderFindings}
              onRevalidate={refreshReadiness}
              className="mt-3"
            />
          ) : null}

          <div className="mt-4 flex rounded-xl bg-background/80 p-1 ring-1 ring-border/80">
            <button
              type="button"
              onClick={() => setTab("web")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-semibold transition",
                tab === "web" ? "bg-surface text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              <Globe className="size-3.5" strokeWidth={1.75} /> Web
            </button>
            <button
              type="button"
              onClick={() => setTab("mobile")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-semibold transition",
                tab === "mobile" ? "bg-surface text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              <Smartphone className="size-3.5" strokeWidth={1.75} /> Mobile
              <span className="rounded-md bg-violet-500/15 px-1.5 py-px text-[9px] font-bold uppercase text-violet-600 dark:text-violet-300">
                Pro+
              </span>
            </button>
          </div>
        </div>

        <motion.div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-12">
          {posting && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/92 px-6 backdrop-blur-sm"
              data-testid="publish-progress-overlay"
            >
              <Loader2 className="size-8 animate-spin text-accent" />
              <p className="text-[13px] font-medium text-foreground">Publishing to web…</p>
              <p className="text-[11.5px] text-muted-foreground">
                {publishPhase === "preparing"
                  ? "Preparing publish"
                  : publishPhase === "allocating"
                    ? "Allocating subdomain"
                    : publishPhase === "building"
                      ? "Building deployment"
                      : publishPhase === "finalizing"
                        ? "Finalizing URL"
                        : "Working…"}
              </p>
            </div>
          )}
          {publishError && !posting && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
              data-testid="publish-error-card"
            >
              <p className="font-semibold">Publish failed</p>
              <p className="mt-1">{publishError}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => void ensureWebPublish()}
              >
                Retry
              </Button>
            </div>
          )}
          {!projectId && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-100 ring-1 ring-amber-500/25">
              Start a build first — publishing attaches to your saved app record.
            </p>
          )}

          {loading && projectId && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading publish state…
            </div>
          )}

          {tab === "web" && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border/80">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Live app URL</p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Every app gets a stable public hostname on{" "}
                  <span className="font-medium text-foreground">{publishInfo?.platformBaseDomain ?? "vodex.app"}</span>.
                  Updates to your generated UI roll forward here when you rebuild.
                </p>

                {publicUrl ? (
                  <div className="mt-3 break-all rounded-xl bg-background px-3 py-2.5 font-mono text-[12px] text-foreground ring-1 ring-border">
                    {publicUrl}
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    No subdomain reserved yet — generate a web build first or allocate below.
                  </p>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: webPublishLocked ? 0.94 : 0.97 }}
                  disabled={posting}
                  onClick={() => {
                    if (webPublishLocked) {
                      toast.info(publishBlockerLabel);
                      return;
                    }
                    void ensureWebPublish();
                  }}
                  className={cn(
                    "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold text-white shadow-lg transition",
                    posting
                      ? "cursor-not-allowed bg-muted text-muted-foreground shadow-none"
                      : webPublishLocked
                        ? "cursor-not-allowed bg-gradient-to-r from-accent/50 to-violet-600/50 opacity-65"
                        : "bg-gradient-to-r from-accent to-violet-600 hover:opacity-95",
                  )}
                >
                  {posting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : webPublishLocked ? (
                    <Lock className="size-4 shrink-0" />
                  ) : (
                    <Rocket className="size-4 shrink-0" />
                  )}
                  {publicUrl
                    ? "Refresh live URL"
                    : webPublishLocked
                      ? "Publish to web (not ready)"
                      : "Publish to web"}
                </motion.button>

                <div className="mt-3 flex flex-wrap gap-2">
                  {publicUrl && (
                    <>
                      <Button type="button" size="sm" variant="secondary" onClick={() => copyUrl(publicUrl)}>
                        <Copy className="mr-1 size-3" /> Copy
                      </Button>
                      <Button type="button" size="sm" variant="secondary" asChild>
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 size-3" /> Open
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "rounded-2xl p-4 ring-1",
                  customAllowed ? "bg-surface/40 ring-border/70" : "bg-muted/15 ring-border/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="size-4 text-muted-foreground" strokeWidth={1.65} />
                  <span className="text-[13px] font-semibold text-foreground">Custom domain</span>
                  {!customAllowed && (
                    <span className="rounded-full bg-muted px-2 py-px text-[10px] font-semibold text-muted-foreground">
                      Upgrade
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {customAllowed
                    ? "Contact us to map your domain — TLS and routing are handled on Vodex infrastructure."
                    : "Custom domains are available on paid plans. Your app still ships on the free subdomain above."}
                </p>
                {!customAllowed && (
                  <Link
                    href="/pricing"
                    className="mt-2 inline-flex text-[12px] font-semibold text-accent hover:underline underline-offset-2"
                  >
                    View plans
                  </Link>
                )}
              </div>

            </div>
          )}

          {tab === "mobile" && (
            <div className="space-y-3">
              {!getEntitlements(planId).canUseMobileWrapping ? (
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-center">
                  <Lock className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-2 text-[13px] font-semibold text-foreground">Mobile packaging requires Pro+</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    You can preview the checklist, but APK/AAB and store builds unlock on a paid plan.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-3 inline-flex rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white"
                  >
                    View plans
                  </Link>
                </div>
              ) : null}
              <div className="flex items-start gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-[12px] text-violet-950 dark:text-violet-100 ring-1 ring-violet-500/20">
                <Smartphone className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                <div>
                  <p className="font-semibold">Mobile App · Pro and above</p>
                  <p className="mt-0.5 opacity-90">
                    Packaging scans your saved source for store-readiness, then queues APK/AAB jobs on honest infrastructure
                    status — no fake &quot;build succeeded&quot; toasts.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-background/80 p-4 ring-1 ring-border/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Step 1 · Eligibility scan
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!projectId || mobileScanning}
                    onClick={() => void runMobileEligibilityScan()}
                  >
                    {mobileScanning ? <Loader2 className="size-3.5 animate-spin" /> : "Run full app scan"}
                  </Button>
                </div>
                {!mobileGatePassed ? (
                  <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
                    Run the scan and pass all blockers before Android / iOS packaging unlocks.
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5" /> Eligible for packaging
                  </p>
                )}
              </div>

              <div
                className={cn(
                  "space-y-3",
                  !mobileGatePassed && "pointer-events-none select-none opacity-45",
                )}
              >
              <div className="rounded-2xl bg-background/80 p-4 ring-1 ring-border/80">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ship checklist</p>
                <ol className="mt-3 list-none space-y-2.5 text-[12px] text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[11px] font-bold text-accent">
                      1
                    </span>
                    <span>
                      Run a full build so files and previews are saved to your app record — publishing attaches to that.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[11px] font-bold text-accent">
                      2
                    </span>
                    <span>Review the readiness scan — fix blockers before store packaging.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[11px] font-bold text-accent">
                      3
                    </span>
                    <span>Pick <strong className="text-foreground">Android</strong> or <strong className="text-foreground">iOS</strong> — we only queue jobs your plan actually unlocks.</span>
                  </li>
                </ol>
              </div>

              <div className="flex rounded-xl bg-muted/50 p-1 ring-1 ring-border/70">
                <button
                  type="button"
                  onClick={() => setMobilePlatform("android")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition",
                    mobilePlatform === "android" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground",
                  )}
                >
                  <Smartphone className="size-3.5" strokeWidth={1.75} />
                  Android
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePlatform("ios")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition",
                    mobilePlatform === "ios" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground",
                  )}
                >
                  <Apple className="size-3.5" strokeWidth={1.75} />
                  iOS
                </button>
              </div>

              <div className="rounded-2xl bg-surface/50 p-4 ring-1 ring-border/80">
                <p className="text-[12px] font-semibold text-foreground">App Store Readiness Scan</p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Rule-based review of generated files ({readiness?.fileCount ?? 0} on disk).
                </p>
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {!readiness?.issues?.length && !loading && (
                    <li className="flex gap-2 text-[12px] text-muted-foreground">
                      <CheckCircle2 className="size-4 shrink-0 text-positive" strokeWidth={1.75} />
                      No blockers detected — run a build that saves files first if this stays empty.
                    </li>
                  )}
                  {(readiness?.issues ?? []).map((issue, i) => (
                    <li
                      key={`${issue.code ?? issue.title ?? i}-${i}`}
                      className="flex gap-2 rounded-lg bg-background/80 px-2 py-1.5 text-[11.5px] ring-1 ring-border/60"
                    >
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0",
                          issue.severity === "error" ? "text-destructive" : "text-amber-600",
                        )}
                        strokeWidth={1.75}
                      />
                      <span>{issue.message ?? issue.detail ?? issue.title}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant={androidLocked || mobilePlatform === "ios" ? "secondary" : "accent"}
                  className="w-full"
                  disabled={
                    androidLocked ||
                    mobilePlatform === "ios" ||
                    !projectId ||
                    wrapBusy !== null ||
                    !mobileGatePassed
                  }
                  onClick={() => {
                    if (mobilePlatform === "android") void requestWrap("android_aab");
                    else toast.info("Open Mobile App in the builder for iOS wrapped exports.");
                  }}
                >
                  {androidLocked ? (
                    <span className="flex items-center gap-1">
                      <Lock className="size-3.5" /> Upgrade for store builds
                    </span>
                  ) : wrapBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : mobilePlatform === "android" ? (
                    "Build Android AAB (wrapped)"
                  ) : (
                    "Build iOS package (wrapped)"
                  )}
                </Button>
                {projectId ? (
                  <Button type="button" variant="secondary" className="w-full" asChild>
                    <Link href={`/apps/${projectId}/builder?tab=mobile`}>Open Mobile App setup</Link>
                  </Button>
                ) : null}
              </div>

              <details className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                  Advanced: raw APK/AAB without wrapper (developer export)
                </summary>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-[11px]"
                    disabled={androidLocked || !projectId || wrapBusy !== null || !mobileGatePassed}
                    onClick={() => void requestWrap("android_apk")}
                  >
                    {wrapBusy === "android_apk" ? <Loader2 className="size-3.5 animate-spin" /> : "APK (no wrapper)"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-[11px]"
                    disabled={androidLocked || !projectId || wrapBusy !== null || !mobileGatePassed}
                    onClick={() => void requestWrap("android_aab")}
                  >
                    {wrapBusy === "android_aab" ? <Loader2 className="size-3.5 animate-spin" /> : "AAB (no wrapper)"}
                  </Button>
                </div>
              </details>

              {androidLocked && (
                <Link
                  href="/pricing"
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-violet-600 px-4 py-2.5 text-center text-[12.5px] font-semibold text-white shadow-md transition hover:opacity-95"
                >
                  Unlock mobile builds
                </Link>
              )}

              {lastWrapJob && (
                <div className="rounded-xl bg-muted/30 px-3 py-2 text-[11.5px] ring-1 ring-border/70">
                  <p className="font-semibold text-foreground">Last job · {lastWrapJob.status}</p>
                  {lastWrapJob.error_message && (
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{lastWrapJob.error_message}</p>
                  )}
                </div>
              )}
              </div>
            </div>
          )}

        </motion.div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
      )}
    </>
  );
}
