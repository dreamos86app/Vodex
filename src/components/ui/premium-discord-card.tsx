"use client";

import { cn } from "@/lib/utils";

export const VODEX_DISCORD_URL = "https://discord.gg/TzV73DfWG6";
export const DISCORD_BRAND_BLUE = "#5865F2";

export function DiscordGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function IcySparkles({ dense }: { dense?: boolean }) {
  const dots = dense
    ? [
        { left: "10%", top: "22%", delay: "0s", size: 2 },
        { left: "78%", top: "18%", delay: "0.6s", size: 2 },
        { left: "62%", top: "68%", delay: "1.1s", size: 2 },
      ]
    : [
        { left: "8%", top: "18%", delay: "0s", size: 3 },
        { left: "22%", top: "62%", delay: "0.4s", size: 2 },
        { left: "44%", top: "28%", delay: "0.8s", size: 2 },
        { left: "68%", top: "54%", delay: "1.1s", size: 3 },
        { left: "84%", top: "22%", delay: "0.2s", size: 2 },
      ];
  return (
    <div className="vodex-sparkle-field pointer-events-none absolute inset-0" aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          className="vodex-sparkle-dot absolute rounded-full bg-sky-100"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

type PremiumDiscordCardProps = {
  className?: string;
  variant?: "hero" | "compact" | "footer";
  testId?: string;
};

export function PremiumDiscordCard({
  className,
  variant = "hero",
  testId = "vodex-discord-community-card",
}: PremiumDiscordCardProps) {
  const isFooter = variant === "footer";

  return (
    <a
      href={VODEX_DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className={cn(
        "vodex-discord-card-icy group relative block overflow-hidden rounded-xl border shadow-lg transition",
        isFooter
          ? "vodex-discord-card-icy--footer h-[54px] border-white/25 px-2.5 py-1 shadow-md hover:shadow-lg dark:border-sky-400/20"
          : "rounded-2xl border-[#5865F2]/30 p-4 shadow-lg hover:shadow-xl hover:shadow-[#5865F2]/20 sm:p-5",
        className,
      )}
    >
      <div className="vodex-discord-icy-bg pointer-events-none absolute inset-0" aria-hidden />
      {!isFooter && <IcySparkles />}
      <div
        className={cn(
          "relative flex items-center gap-3",
          isFooter ? "h-full" : "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg bg-[#5865F2] text-white shadow-md ring-1 ring-white/40",
              isFooter ? "size-8 rounded-md bg-[#5865F2]/90" : "size-12 rounded-xl",
            )}
          >
            <DiscordGlyph className={isFooter ? "size-5" : "size-7"} />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "font-semibold tracking-tight text-white drop-shadow-sm",
                isFooter ? "text-[12px] leading-tight" : "text-[17px] sm:text-[18px]",
              )}
            >
              {isFooter ? "Community" : "Join the Vodex Community"}
            </p>
            {!isFooter ? (
              <p className="mt-1 max-w-xl text-[12px] leading-snug text-sky-100/95 sm:text-[13px]">
                Meet builders, share launches, get updates, and follow product announcements.
              </p>
            ) : (
              <p className="truncate text-[10px] text-sky-100/90">Join builders on Discord</p>
            )}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-lg bg-white/95 font-bold text-[#5865F2] shadow-sm transition group-hover:bg-white",
            isFooter ? "ml-auto px-2.5 py-1 text-[10px]" : "px-5 py-2 text-[12px] sm:text-[13px]",
          )}
        >
          {isFooter ? "Join →" : "Join Discord"}
        </span>
      </div>
    </a>
  );
}

export function StatusDiscordSubscribeButton({ className }: { className?: string }) {
  return (
    <a
      href={VODEX_DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="status-discord-subscribe"
      className={cn(
        "vodex-discord-card-icy group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-lg px-3.5 text-[12px] font-semibold text-white shadow-md transition hover:shadow-lg",
        className,
      )}
    >
      <div className="vodex-discord-icy-bg pointer-events-none absolute inset-0" aria-hidden />
      <IcySparkles dense />
      <span className="relative flex size-6 items-center justify-center rounded-md bg-[#5865F2] ring-1 ring-white/35">
        <DiscordGlyph className="size-3.5 text-white" />
      </span>
      <span className="relative">Subscribe for updates</span>
    </a>
  );
}
