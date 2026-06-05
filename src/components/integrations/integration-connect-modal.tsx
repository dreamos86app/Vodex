"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, TestTube2, X, BookOpen, Clock, Gauge } from "lucide-react";
import { IntegrationIconWell } from "@/components/brand/integration-icons";
import { getIntegrationProvider } from "@/lib/generated-apps/integration-registry";
import { getHelpArticle } from "@/lib/help/cms/registry";
import { integrationGuideHref } from "@/components/help/contextual-help";
import { SetupChecklist } from "@/components/help/setup-checklist";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Mode = "live" | "sandbox" | "mock";

const DIFFICULTY: Record<string, string> = {
  github: "beginner",
  supabase: "beginner",
  stripe: "intermediate",
  resend: "beginner",
  openai: "beginner",
  anthropic: "beginner",
  gemini: "beginner",
  firebase: "intermediate",
};

export function IntegrationConnectModal({
  open,
  onClose,
  projectId,
  providerId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  providerId: string;
  onSaved?: () => void;
}) {
  const def = getIntegrationProvider(providerId);
  const guideSlug = providerId === "lemonsqueezy" ? "lemon-squeezy" : providerId;
  const paymentProviders = new Set(["stripe", "paypal", "paddle", "lemon-squeezy", "revenuecat"]);
  const academy = paymentProviders.has(guideSlug)
    ? getHelpArticle("payments", guideSlug)
    : getHelpArticle("integrations", guideSlug);
  const guideHref = integrationGuideHref(providerId);

  const [mode, setMode] = React.useState<Mode>("sandbox");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [testing, setTesting] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{
    ok: boolean;
    label: string;
    message: string;
    connectionHealth?: string;
    webhookStatus?: string;
  } | null>(null);

  if (!open || !def) return null;

  async function runTest(forceMock: boolean) {
    setTesting(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/${providerId}/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceMock, mode: forceMock ? "mock" : mode }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        label?: string;
        message?: string;
        error?: string;
        connectionHealth?: string;
        webhookStatus?: string;
      };
      const result = {
        ok: json.ok === true,
        label: json.label ?? (forceMock ? "mock" : mode),
        message: json.message ?? json.error ?? "Test complete",
        connectionHealth: json.connectionHealth,
        webhookStatus: json.webhookStatus,
      };
      setLastResult(result);
      if (result.ok) toast.success(`${def?.label}: ${result.label} — not live unless labeled live`);
      else toast.error(result.message);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const statusLabel = lastResult?.ok
    ? lastResult.label === "mock"
      ? "Mock verified"
      : lastResult.label === "live"
        ? "Connected (live)"
        : "Connected (sandbox)"
    : "Not started";

  return (
    <div className="fixed inset-0 z-[10003] flex items-start justify-center bg-black/40 p-4 pt-[6vh] backdrop-blur-[2px]">
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border md:max-h-[85vh] md:flex-row"
        data-testid={`integration-connect-modal-${providerId}`}
      >
        <aside className="border-b border-border bg-muted/20 p-5 md:w-[42%] md:border-b-0 md:border-r">
          <div className="flex items-start gap-3">
            <IntegrationIconWell provider={providerId} className="size-11 shrink-0" />
            <div>
              <h2 className="text-[16px] font-semibold">{def.label}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{def.description}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-[11px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="size-3.5" />
              Difficulty: <span className="font-medium capitalize text-foreground">{DIFFICULTY[providerId] ?? "beginner"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5" />
              Setup: <span className="font-medium text-foreground">{academy?.readMinutes ?? 10} min</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                  lastResult?.ok ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground",
                )}
              >
                {statusLabel}
              </span>
            </div>
          </dl>
          {academy?.checklist ? (
            <div className="mt-4">
              <SetupChecklist projectId={projectId} providerId={providerId} items={academy.checklist} />
            </div>
          ) : null}
          <Link
            href={guideHref}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:underline"
          >
            <BookOpen className="size-3.5" />
            Open full guide
          </Link>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[12px] font-semibold">Connect</p>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 ring-1 ring-border">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Mode</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["sandbox", "live", "mock"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold ring-1",
                      mode === m ? "bg-accent text-white ring-accent" : "ring-border",
                    )}
                  >
                    {m === "mock" ? "Mock" : m}
                  </button>
                ))}
              </div>
            </div>
            {mode !== "mock"
              ? def.fields.map((f) => (
                  <label key={f.key} className="block text-[11px]">
                    <span className="font-medium">{f.label}</span>
                    <input
                      type={f.secret ? "password" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-[12px]"
                    />
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{f.guide}</span>
                  </label>
                ))
              : (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900">
                  Mock mode — deterministic test only. Never shown as live connected.
                </p>
              )}
            {lastResult ? (
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-[11px] ring-1",
                  lastResult.ok
                    ? "bg-emerald-500/10 ring-emerald-500/20"
                    : "bg-red-500/10 ring-red-500/20",
                )}
              >
                <p>
                  <span className="font-bold uppercase">{lastResult.label}</span> — {lastResult.message}
                </p>
                {lastResult.connectionHealth ? (
                  <p className="mt-1 text-muted-foreground">Health: {lastResult.connectionHealth}</p>
                ) : null}
                {lastResult.webhookStatus ? (
                  <p className="text-muted-foreground">Webhook: {lastResult.webhookStatus}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              disabled={testing}
              onClick={() => void runTest(mode === "mock")}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <TestTube2 className="size-4" />}
              Test connection
            </button>
            <Link href={guideHref} className="rounded-xl px-3 py-2 text-[12px] ring-1 ring-border">
              Learn more
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
