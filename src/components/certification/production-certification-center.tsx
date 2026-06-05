"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Loader2,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Award,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { ProductionCertificationResult } from "@/lib/certification/types";

const LEVEL_COLORS: Record<string, string> = {
  NOT_READY: "text-red-600 bg-red-500/10 ring-red-500/20",
  BASIC: "text-amber-700 bg-amber-500/10 ring-amber-500/20",
  BETA_READY: "text-sky-700 bg-sky-500/10 ring-sky-500/20",
  PRODUCTION_READY: "text-emerald-700 bg-emerald-500/10 ring-emerald-500/20",
  ENTERPRISE_READY: "text-violet-700 bg-violet-500/10 ring-violet-500/20",
};

const SECTION_ORDER = [
  "security",
  "auth",
  "integrations",
  "payments",
  "publish",
  "mobile",
  "performance",
  "data",
  "dashboard",
  "app_audit",
];

function StatusIcon({ status }: { status: string }) {
  if (status === "passed") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "blocker") return <XCircle className="size-4 text-red-600" />;
  return <AlertTriangle className="size-4 text-amber-600" />;
}

export function ProductionCertificationCenter({ projectId }: { projectId: string }) {
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<ProductionCertificationResult | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>("security");

  async function runCertification() {
    setRunning(true);
    setResult(null);
    setProgress(0);
    const timer = window.setInterval(() => {
      setProgress((p) => Math.min(p + 8, 92));
    }, 400);
    try {
      const res = await fetch(`/api/projects/${projectId}/certification/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as { certification?: ProductionCertificationResult; error?: string };
      if (!res.ok || !body.certification) throw new Error(body.error ?? "Certification failed");
      setResult(body.certification);
      setProgress(100);
      if (body.certification.blockers > 0) {
        toast.error(`${body.certification.blockers} blocker(s) — not production ready`);
      } else {
        toast.success(`Certification complete: ${body.certification.certification_level}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Certification failed");
    } finally {
      window.clearInterval(timer);
      setRunning(false);
    }
  }

  const sections = result?.sections
    .slice()
    .sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id));

  return (
    <div
      className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-accent/5 p-5 ring-1 ring-border/50"
      data-testid="production-certification-center"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="size-5 text-accent" />
            <h3 className="text-[15px] font-semibold text-foreground">Production Certification</h3>
          </div>
          <p className="mt-1 max-w-lg text-[12px] text-muted-foreground">
            Universal audit for AI-generated, imported, cloned, and repaired apps. Scores come from
            real checks — never synthetic success.
          </p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => void runCertification()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
          {running ? "Running audit…" : "Run Production Certification"}
        </button>
      </div>

      {running ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Scanning routes, auth, payments, data…</p>
        </div>
      ) : null}

      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 space-y-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-3xl font-bold tabular-nums text-foreground">{result.overall_score}</div>
              <div>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1",
                    LEVEL_COLORS[result.certification_level] ?? LEVEL_COLORS.NOT_READY,
                  )}
                >
                  {result.certification_level.replace(/_/g, " ")}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {result.passed_checks} passed · {result.warnings} warnings · {result.blockers} blockers
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {sections?.map((section) => (
                <div key={section.id} className="rounded-xl ring-1 ring-border/60 overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between bg-muted/20 px-3 py-2.5 text-left"
                    onClick={() => setExpanded(expanded === section.id ? null : section.id)}
                  >
                    <span className="text-[13px] font-medium">{section.label}</span>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {section.score}/100
                      <ChevronDown
                        className={cn("size-4 transition", expanded === section.id && "rotate-180")}
                      />
                    </span>
                  </button>
                  {expanded === section.id ? (
                    <ul className="divide-y divide-border/50 px-3 py-1">
                      {section.checks.map((c) => (
                        <li key={c.id} className="flex gap-2 py-2 text-[12px]">
                          <StatusIcon status={c.status} />
                          <div>
                            <p className="font-medium">{c.title}</p>
                            <p className="text-muted-foreground">{c.detail}</p>
                            {c.fix ? (
                              <p className="mt-0.5 text-[11px] text-accent">Fix: {c.fix}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>

            {result.launch_checklist.length ? (
              <div className="rounded-xl bg-muted/20 p-3 ring-1 ring-border/50">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Launch checklist</p>
                <ul className="mt-2 space-y-1">
                  {result.launch_checklist.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-[12px]">
                      {item.status === "done" ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                      ) : item.status === "blocked" ? (
                        <XCircle className="size-3.5 text-red-600" />
                      ) : (
                        <span className="size-3.5 rounded-full border border-border" />
                      )}
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.auto_fix_suggestions.length ? (
              <div className="rounded-xl bg-muted/20 p-3 ring-1 ring-border/50">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                  <Wrench className="size-3.5" />
                  Suggested fixes (review before applying)
                </p>
                <ul className="mt-2 space-y-2">
                  {result.auto_fix_suggestions.slice(0, 6).map((s) => (
                    <li key={s.id} className="text-[12px]">
                      <span className="font-medium">{s.title}</span>
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">({s.kind})</span>
                      <p className="text-muted-foreground">{s.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
