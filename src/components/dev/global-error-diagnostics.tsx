"use client";

import * as React from "react";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import {
  buildRouteErrorFixPrompt,
  buildSanitizedCrashReport,
} from "@/lib/dev/route-error-fix-prompt";
import {
  collectRouteErrorContext,
  persistRouteErrorPayload,
} from "@/lib/dev/route-error-context";

/** Inline-styled diagnostics for global-error (no Tailwind in root crash shell). */
export function GlobalErrorDiagnostics({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const [isOwner, setIsOwner] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const payload = React.useMemo(
    () => collectRouteErrorContext(error, "global"),
    [error],
  );

  React.useEffect(() => {
    persistRouteErrorPayload(payload);
    void fetch("/api/account/identity", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ownerEmail?: string } | null) => {
        setIsOwner(Boolean(json?.ownerEmail && isDreamosOwnerEmail(json.ownerEmail)));
      })
      .catch(() => setIsOwner(false));
  }, [payload]);

  const copy = async () => {
    const text = isOwner
      ? buildRouteErrorFixPrompt(payload)
      : buildSanitizedCrashReport(payload);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  const box: React.CSSProperties = {
    marginTop: 20,
    width: "100%",
    maxWidth: 640,
    textAlign: "left",
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,0.4)",
    background: isOwner ? "rgba(69,26,3,0.95)" : "rgba(15,23,42,0.9)",
    color: isOwner ? "#fef3c7" : "#e2e8f0",
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
    padding: 0,
    overflow: "hidden",
  };

  return (
    <div style={box} data-testid="global-error-diagnostics">
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(245,158,11,0.25)" }}>
        <strong style={{ fontSize: 12 }}>
          {isOwner ? "Owner crash diagnostics" : "Crash report"}
        </strong>
        <div style={{ opacity: 0.75, marginTop: 4 }}>
          {isOwner ? "Copy full fix prompt below." : "Sign in as owner for full details."}
        </div>
      </div>
      <div style={{ padding: "12px 16px", maxHeight: 280, overflow: "auto" }}>
        <div>
          <strong>message:</strong> {payload.message}
        </div>
        {isOwner && payload.stack ? (
          <pre
            style={{
              marginTop: 8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              background: "rgba(0,0,0,0.25)",
              padding: 8,
              borderRadius: 8,
            }}
          >
            {payload.stack}
          </pre>
        ) : null}
        <div style={{ marginTop: 8 }}>
          <strong>route:</strong> {payload.route ?? "—"}
        </div>
        {isOwner ? (
          <>
            <div>
              <strong>project_id:</strong> {payload.projectId ?? "—"}
            </div>
            <div>
              <strong>autostart:</strong> {payload.autostart ?? "—"}
            </div>
            <div>
              <strong>strategy:</strong> {payload.strategy ?? "—"}
            </div>
            <div>
              <strong>conversationId:</strong> {payload.conversationId ?? "—"}
            </div>
          </>
        ) : payload.digest ? (
          <div>
            <strong>digest:</strong> {payload.digest}
          </div>
        ) : null}
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(245,158,11,0.25)" }}>
        <button
          type="button"
          onClick={() => void copy()}
          style={{
            background: isOwner ? "#fbbf24" : "#6366f1",
            color: isOwner ? "#451a03" : "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied
            ? "Copied"
            : isOwner
              ? "Copy full fix prompt"
              : "Copy crash report"}
        </button>
      </div>
    </div>
  );
}
