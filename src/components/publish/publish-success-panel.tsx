"use client";

import * as React from "react";
import { Copy, ExternalLink, PartyPopper, QrCode, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { PlatformShareButton, type SharePlatform } from "@/components/publish/platform-share-icons";

type ShareNetwork = "facebook" | "linkedin" | "x" | "whatsapp" | "reddit";

const SHARE: Array<{ id: ShareNetwork; label: string; href: (url: string, title: string) => string }> = [
  {
    id: "facebook",
    label: "Facebook",
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
  },
  {
    id: "x",
    label: "X",
    href: (u, t) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    href: (u, t) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
  },
];

function LinkRow({ url, label }: { url: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        {label ? <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p> : null}
        <p className="truncate font-mono text-[12px] text-foreground">{url.replace(/^https?:\/\//, "")}</p>
      </div>
      <button
        type="button"
        aria-label="Copy link"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(
            () => toast.success("Copied"),
            () => toast.error("Could not copy"),
          );
        }}
      >
        <Copy className="size-4" />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in new tab"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

export function PublishSuccessPanel({
  appName,
  publicUrl,
  subdomainUrl,
  customDomain,
  customDomainHint,
  onClose,
  className,
}: {
  appName: string;
  publicUrl: string;
  subdomainUrl?: string | null;
  customDomain?: string | null;
  customDomainHint?: string | null;
  onClose?: () => void;
  className?: string;
}) {
  const title = appName.trim() || "Your app";

  return (
    <div
      className={cn("rounded-2xl border border-border bg-surface p-5 shadow-lg ring-1 ring-border/80", className)}
      data-testid="publish-success-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight text-foreground">
              Your app is published and live online!
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Share these links — they open your hosted app, not the Vodex builder.
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-background"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your app links</p>
      <div className="mt-2 space-y-2">
        <LinkRow url={publicUrl} label="Primary live URL" />
        {subdomainUrl && subdomainUrl !== publicUrl ? (
          <LinkRow url={subdomainUrl} label="Subdomain" />
        ) : null}
        {customDomain ? <LinkRow url={`https://${customDomain}`} label="Custom domain" /> : null}
      </div>

      {customDomainHint ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          {customDomainHint}{" "}
          <a href="/pricing" className="font-semibold text-accent hover:underline">
            View plans
          </a>
        </p>
      ) : null}

      <p className="mt-4 text-[11px] font-semibold text-foreground">Sharing options</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SHARE.map((s) => (
          <PlatformShareButton
            key={s.id}
            platform={s.id as SharePlatform}
            href={s.href(publicUrl, title)}
            title={s.label}
          />
        ))}
        <PlatformShareButton
          platform="email"
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(publicUrl)}`}
          title="Email"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white"
        >
          Open live app
        </a>
        {customDomainHint ? (
          <a href="/billing" className="rounded-xl px-4 py-2 text-[12px] font-medium ring-1 ring-border">
            Add custom domain
          </a>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-[12px] ring-1 ring-border"
          onClick={() => toast.info("QR — scan from mobile to open app")}
        >
          <QrCode className="size-3.5" /> QR code
        </button>
      </div>
    </div>
  );
}
