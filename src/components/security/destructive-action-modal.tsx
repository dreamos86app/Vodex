"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OverlayDialog } from "@/components/ui/overlay-dialog";
import {
  DESTRUCTIVE_ACTION_PHRASES,
  destructiveActionSummary,
  type DestructiveActionType,
} from "@/lib/security/destructive-action-types";

type Props = {
  open: boolean;
  onClose: () => void;
  actionType: DestructiveActionType;
  targetName?: string | null;
  targetId?: string | null;
  onVerifiedDelete: (verificationId: string) => Promise<void>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function DestructiveActionModal({
  open,
  onClose,
  actionType,
  targetName,
  targetId,
  onVerifiedDelete,
  returnFocusRef,
}: Props) {
  const phrase = DESTRUCTIVE_ACTION_PHRASES[actionType];
  const summary = destructiveActionSummary(actionType, targetName);

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [typedPhrase, setTypedPhrase] = React.useState("");
  const [verificationId, setVerificationId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [devHint, setDevHint] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setStep(1);
      setTypedPhrase("");
      setVerificationId(null);
      setCode("");
      setError(null);
      setDevHint(null);
      setLoading(false);
    }
  }, [open]);

  const phraseOk = typedPhrase.trim().toLowerCase() === phrase;

  async function sendCode(resend = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/security/destructive-action/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          actionType,
          confirmationPhrase: typedPhrase,
          targetId: targetId ?? null,
          targetName: targetName ?? null,
          resendVerificationId: resend ? verificationId : null,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        verificationId?: string;
        devOtpHint?: string;
        message?: string;
        retryAfterSec?: number;
      };
      if (!res.ok) {
        throw new Error(
          json.retryAfterSec
            ? `${json.error ?? "Request failed"} (retry in ${json.retryAfterSec}s)`
            : json.error ?? "Could not send verification email",
        );
      }
      setVerificationId(json.verificationId ?? null);
      setDevHint(json.devOtpHint ?? null);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndDelete() {
    if (!verificationId || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const verifyRes = await fetch("/api/security/destructive-action/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ verificationId, code: code.trim() }),
      });
      const verifyJson = (await verifyRes.json()) as { error?: string; verified?: boolean };
      if (!verifyRes.ok || !verifyJson.verified) {
        throw new Error(verifyJson.error ?? "Invalid verification code");
      }
      await onVerifiedDelete(verificationId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OverlayDialog
      open={open}
      onClose={onClose}
      layer="confirmation"
      returnFocusRef={returnFocusRef}
      data-testid="destructive-action-modal"
      panelClassName="max-w-md"
    >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground">Confirm destructive action</p>
              <p className="text-[12px] text-muted-foreground">
                Step {step} of 3 —{" "}
                {step === 1 ? "Type phrase" : step === 2 ? "Email verification" : "Enter code"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-surface hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-[13px] text-muted-foreground">{summary}</p>

          {error ? (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive ring-1 ring-destructive/20">
              {error}
            </div>
          ) : null}

          {step === 1 ? (
            <>
              <p className="text-[12px] text-foreground">
                Type <span className="font-mono font-semibold text-destructive">{phrase}</span> to
                continue.
              </p>
              <Input
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                placeholder={phrase}
                className="font-mono text-[13px]"
                data-testid="destructive-action-phrase-input"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!phraseOk}
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  data-testid="destructive-action-phrase-continue"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 ring-1 ring-border">
                <Mail className="size-5 shrink-0 text-muted-foreground" />
                <p className="text-[12px] text-muted-foreground">
                  We&apos;ll email a 6-digit code to your account address. It expires in 10 minutes.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep(1)} disabled={loading}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  disabled={loading}
                  onClick={() => void sendCode(false)}
                  data-testid="destructive-action-send-code"
                >
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Send verification code
                </Button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              {devHint ? (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-800 dark:text-amber-200">
                  Dev code: {devHint}
                </p>
              ) : null}
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                className="font-mono text-center text-[18px] tracking-[0.3em]"
                data-testid="destructive-action-code-input"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => void sendCode(true)}
                >
                  Resend code
                </Button>
                <Button
                  variant="destructive"
                  className="flex-[2] gap-1.5"
                  disabled={loading || code.length < 6}
                  onClick={() => void verifyAndDelete()}
                  data-testid="destructive-action-confirm-delete"
                >
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Confirm & delete
                </Button>
              </div>
            </>
          ) : null}
        </div>
    </OverlayDialog>
  );
}
