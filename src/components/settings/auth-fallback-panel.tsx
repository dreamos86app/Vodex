"use client";

import * as React from "react";
import { Mail, KeyRound, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  oauthFailed?: boolean;
  emailEnabled: boolean;
  onEnableEmail?: () => void;
  loginUrl?: string | null;
  className?: string;
};

export function AuthFallbackPanel({
  oauthFailed = false,
  emailEnabled,
  onEnableEmail,
  loginUrl,
  className,
}: Props) {
  if (!oauthFailed && emailEnabled) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/8 p-4",
        className,
      )}
      data-testid="auth-fallback-panel"
    >
      <p className="text-[13px] font-semibold text-foreground">Backup sign-in options</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        If OAuth is misconfigured or unavailable, users can still sign in without a dead-end.
      </p>
      <ul className="mt-3 space-y-2">
        <FallbackRow
          icon={Mail}
          title="Email & password"
          detail={emailEnabled ? "Enabled" : "Enable email login as a reliable fallback"}
          active={emailEnabled}
          action={
            !emailEnabled && onEnableEmail ? (
              <button
                type="button"
                onClick={onEnableEmail}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                Enable
              </button>
            ) : null
          }
        />
        <FallbackRow
          icon={Link2}
          title="Magic link / Email OTP"
          detail="Supported via Supabase Auth when email provider is configured"
          active={emailEnabled}
        />
        {loginUrl ? (
          <FallbackRow
            icon={KeyRound}
            title="Test login page"
            detail="Open your published login to verify fallbacks"
            active
            action={
              <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-accent">
                Open
              </a>
            }
          />
        ) : null}
      </ul>
    </div>
  );
}

function FallbackRow({
  icon: Icon,
  title,
  detail,
  active,
  action,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
  active?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg bg-background/70 px-3 py-2 ring-1 ring-border/60">
      <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-emerald-600" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </div>
      {action}
    </li>
  );
}
