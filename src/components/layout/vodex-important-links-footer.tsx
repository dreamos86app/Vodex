"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PremiumDiscordCard } from "@/components/ui/premium-discord-card";
import { FooterIcedBirds } from "@/components/layout/footer-iced-birds";

const STATUS_URL = "https://status.vodex.dev";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Home" },
      { href: "/projects", label: "Apps" },
      { href: "/templates", label: "Templates" },
      { href: "/explore", label: "Explore" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/deploy", label: "Deploy" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/help", label: "Help" },
      { href: "/changelog", label: "Changelog" },
      { href: STATUS_URL, label: "Status", external: true },
      { href: "https://discord.gg/y8EbeMc9Mb", label: "Discord Community", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refunds", label: "Refund Policy" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Billing",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/settings/billing", label: "Billing" },
      { href: "/pricing", label: "Upgrade" },
    ],
  },
] as const;

export function VodexImportantLinksFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "vodex-important-links-footer relative mt-auto shrink-0 overflow-hidden border-t border-sky-200/60",
        "bg-gradient-to-br from-sky-50 via-white to-blue-50/90",
        className,
      )}
      data-testid="vodex-important-links-footer"
    >
      <div className="vodex-footer-ambient pointer-events-none absolute inset-0" aria-hidden />
      <FooterIcedBirds />
      <div className="vodex-footer-bird-trail pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-[var(--page-padding-x)] py-10">
        <div className="mb-8 grid gap-8 lg:grid-cols-[1fr_minmax(260px,320px)]">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-800/90 drop-shadow-sm">
                  {col.title}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.label}`}>
                      {"external" in link && link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12.5px] font-semibold text-slate-600/95 transition hover:text-sky-700 hover:underline"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[12.5px] font-semibold text-slate-600/95 transition hover:text-sky-700 hover:underline"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <PremiumDiscordCard variant="footer" testId="footer-discord-social" />
        </div>
        <p className="text-center text-[11px] font-semibold tracking-wide text-slate-500/90">
          © {new Date().getFullYear()} Vodex · Built for AI-native creators
        </p>
      </div>
    </footer>
  );
}
