"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const DISCORD_URL = "https://discord.gg/y8EbeMc9Mb";

export function VodexDiscordCommunityCard({ className }: { className?: string }) {
  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="vodex-discord-community-card"
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-indigo-400/30 p-6 shadow-lg transition",
        "bg-gradient-to-br from-[#5865F2] via-[#4752C4] to-[#3c45a5]",
        "hover:border-indigo-300/50 hover:shadow-[0_0_40px_-8px_rgba(88,101,242,0.65)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <MessageCircle className="size-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-white">Join the Vodex community</p>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-indigo-100/90">
              Connect with builders, share launches, get updates, and follow product announcements.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-2.5 text-[13px] font-semibold text-[#4752C4] shadow-md transition group-hover:scale-[1.02]">
          Join Discord
        </span>
      </div>
    </a>
  );
}
