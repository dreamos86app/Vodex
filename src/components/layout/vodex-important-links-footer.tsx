"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const DISCORD_URL = "https://discord.gg/y8EbeMc9Mb";
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
      { href: DISCORD_URL, label: "Discord Community", external: true },
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
        "vodex-important-links-footer mt-auto border-t border-sky-500/15 bg-gradient-to-b from-slate-950/40 via-[#0a1628]/90 to-[#060d18]",
        className,
      )}
      data-testid="vodex-important-links-footer"
    >
      <div className="mx-auto max-w-6xl px-[var(--page-padding-x)] py-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-300/80">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-sky-100/75 transition hover:text-white hover:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[12px] text-sky-100/75 transition hover:text-white hover:underline"
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
        <p className="mt-8 text-center text-[11px] text-sky-200/40">
          © {new Date().getFullYear()} Vodex · Built for AI-native creators
        </p>
      </div>
    </footer>
  );
}
