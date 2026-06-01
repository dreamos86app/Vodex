"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, Mail, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VodexBrandLockup } from "@/components/brand/vodex-brand-lockup";
import { SUPPORT_MAILTO } from "@/lib/branding/brand-assets";
import { cn } from "@/lib/utils";

type Preview = {
  status: string;
  workspace_name?: string;
  email?: string;
  role?: string;
  expires_at?: string;
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [accepting, setAccepting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`);
        const data = (await res.json()) as Preview;
        setPreview(data);
      } catch {
        setPreview({ status: "not_found" });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        workspace_id?: string;
      };
      if (res.status === 401) {
        const next = `/invite/${encodeURIComponent(token)}`;
        router.push(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!res.ok) {
        throw new Error(j.error ?? "Could not accept invitation");
      }
      setAccepted(true);
      setTimeout(() => {
        router.push("/projects");
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setAccepting(false);
    }
  }

  const loginNext = `/invite/${encodeURIComponent(token)}`;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-atmosphere px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.18),transparent)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-[120%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)]" />

      <div className="relative mb-10">
        <VodexBrandLockup variant="header" />
      </div>

      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 p-[1px]",
          "bg-gradient-to-br from-violet-500/20 via-border/40 to-indigo-500/20 shadow-2xl",
        )}
      >
        <div className="rounded-[calc(1rem-1px)] bg-background/95 p-6 backdrop-blur-md sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="size-7 animate-spin text-accent" />
              <p className="text-[13px]">Loading invitation…</p>
            </div>
          ) : accepted ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-positive/15 ring-1 ring-positive/30">
                <CheckCircle2 className="size-8 text-positive" strokeWidth={1.5} />
              </div>
              <p className="text-[18px] font-semibold text-foreground">You&apos;re in!</p>
              <p className="text-[13px] text-muted-foreground">Redirecting to your projects…</p>
            </div>
          ) : preview?.status === "pending" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
                  <Mail className="size-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-violet-400">
                    Workspace invite
                    <Sparkles className="size-3" />
                  </p>
                  <h1 className="text-[20px] font-semibold leading-tight text-foreground">
                    Join {preview.workspace_name ?? "a workspace"}
                  </h1>
                </div>
              </div>

              <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
                You&apos;ve been invited as{" "}
                <strong className="font-medium text-foreground capitalize">{preview.role}</strong>
                {preview.email ? (
                  <>
                    {" "}
                    for{" "}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                      {preview.email}
                    </span>
                  </>
                ) : null}
              </p>

              <div className="mt-4 flex gap-2 rounded-xl border border-border/80 bg-muted/30 p-3 text-[12px] leading-relaxed text-muted-foreground">
                <Wallet className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.6} />
                <p>
                  By default, AI usage in shared workspaces consumes{" "}
                  <strong className="text-foreground">your own credits</strong>, unless the owner enables
                  workspace-sponsored billing.
                </p>
              </div>

              {error ? (
                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  variant="accent"
                  className="h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md hover:from-violet-500 hover:to-indigo-500"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                >
                  {accepting ? <Loader2 className="size-4 animate-spin" /> : "Accept invitation"}
                </Button>
                <Link
                  href={`/auth/login?next=${encodeURIComponent(loginNext)}`}
                  className="py-2 text-center text-[12px] text-muted-foreground transition hover:text-foreground"
                >
                  Sign in with a different account
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <XCircle className="size-10 text-destructive/80" strokeWidth={1.5} />
              <p className="text-[17px] font-semibold text-foreground">Invitation unavailable</p>
              <p className="max-w-xs text-[13px] text-muted-foreground">
                {preview?.status === "expired" && "This invitation has expired."}
                {preview?.status === "revoked" && "This invitation was revoked."}
                {preview?.status === "accepted" && "This invitation was already accepted."}
                {preview?.status === "not_found" && "We could not find this invitation."}
                {!preview?.status && "Something went wrong."}
              </p>
              <a href={SUPPORT_MAILTO} className="text-[12px] font-medium text-accent hover:underline">
                Contact support
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
