"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PremiumDiscordCard } from "@/components/ui/premium-discord-card";
import { FooterIcedBirds } from "@/components/layout/footer-iced-birds";

const STATUS_URL = "https://status.vodex.dev";

const LINK_COLUMNS = [
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
      { href: "https://discord.gg/TzV73DfWG6", label: "Discord Community", external: true },
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
] as const;

const BILLING_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/settings/billing", label: "Billing" },
] as const;

function FooterLinkColumn({
  title,
  links,
  children,
}: {
  title: string;
  links: readonly { href: string; label: string; external?: boolean }[];
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="vodex-footer-title-glow text-[11px] font-extrabold uppercase tracking-[0.2em] text-sky-800 dark:text-cyan-200">
        {title}
      </p>
      <ul className="mt-2.5 space-y-2">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            {"external" in link && link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-semibold text-slate-700/95 transition hover:text-sky-800 hover:underline dark:text-slate-300/95 dark:hover:text-cyan-200"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-[12.5px] font-semibold text-slate-700/95 transition hover:text-sky-800 hover:underline dark:text-slate-300/95 dark:hover:text-cyan-200"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

export function VodexImportantLinksFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "vodex-important-links-footer relative mt-auto shrink-0 overflow-hidden",
        className,
      )}
      data-testid="vodex-important-links-footer"
    >
      <div className="vodex-footer-depth-glow pointer-events-none absolute inset-0 z-0" aria-hidden />
      <div className="vodex-footer-particles pointer-events-none absolute inset-0 z-0" aria-hidden />
      <div className="vodex-footer-snow-crystals pointer-events-none absolute inset-0 z-0" aria-hidden />
      <div className="vodex-footer-ambient pointer-events-none absolute inset-0 z-0" aria-hidden />
      <FooterIcedBirds />

      <div className="vodex-footer-glass relative z-[2]">
        <div className="vodex-footer-discord-standalone vodex-footer-discord-mobile mx-auto max-w-6xl px-[var(--page-padding-x)] pb-4 pt-5 sm:pb-5 sm:pt-6 lg:hidden">
          <PremiumDiscordCard
            variant="footer"
            testId="footer-discord-social"
            className="vodex-discord-card-icy--footer mx-auto w-full max-w-md"
          />
        </div>

        <div className="vodex-footer-columns mx-auto max-w-6xl border-t border-white/20 px-[var(--page-padding-x)] pb-2 pt-6 dark:border-sky-400/10 sm:pt-8 lg:border-t-0 lg:pt-2">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 lg:pt-4">
            {LINK_COLUMNS.map((col) => (
              <FooterLinkColumn key={col.title} title={col.title} links={col.links} />
            ))}
            <FooterLinkColumn title="Billing" links={BILLING_LINKS}>
              <div className="vodex-footer-discord-desktop mt-4 hidden lg:block">
                <PremiumDiscordCard
                  variant="footer"
                  testId="footer-discord-social-desktop"
                  className="vodex-discord-card-icy--footer w-full max-w-[260px]"
                />
              </div>
            </FooterLinkColumn>
          </div>
          <p className="vodex-footer-copyright mt-6 text-center text-[11px] font-semibold tracking-wide text-slate-600/90 dark:text-slate-400/95">
            © {new Date().getFullYear()} Vodex · Built for AI-native creators
          </p>
        </div>
      </div>
    </footer>
  );
}
