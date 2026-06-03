"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Puzzle, Plug, Package, Users, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { variants } from "@/lib/motion";

const COMING_FEATURES = [
  {
    icon: Puzzle,
    title: "Extensions",
    description: "Drop-in modules that extend generated apps with new screens and APIs.",
  },
  {
    icon: Plug,
    title: "Plugins",
    description: "Connect billing, analytics, auth, and AI providers without rebuilding from scratch.",
  },
  {
    icon: Package,
    title: "Integrations",
    description: "Pre-wired connectors for the services your apps already depend on.",
  },
  {
    icon: Users,
    title: "Community add-ons",
    description: "Share and install builder-created packages reviewed for quality and safety.",
  },
] as const;

export function MarketplaceComingSoonView() {
  return (
    <div
      className="relative mx-auto max-w-3xl"
      data-testid="marketplace-coming-soon"
    >
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_12%,transparent),transparent_70%)] blur-3xl" />

      <motion.div variants={variants.fadeUp} initial="hidden" animate="show">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">MARKETPLACE</p>
        <h1 className="mt-3 text-balance text-[clamp(1.85rem,3.5vw,2.5rem)] font-semibold tracking-[-0.055em] text-foreground">
          Coming soon
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          The Vodex Marketplace will be your hub for extensions, plugins, integrations, and
          community add-ons — installable into apps you build here. Official starter apps live on{" "}
          <Link href="/templates" className="font-medium text-accent hover:underline">
            Templates
          </Link>
          .
        </p>
      </motion.div>

      <motion.div
        variants={variants.staggerContainer}
        initial="hidden"
        animate="show"
        className="mt-10 grid gap-4 sm:grid-cols-2"
      >
        {COMING_FEATURES.map(({ icon: Icon, title, description }) => (
          <motion.div
            key={title}
            variants={variants.staggerItem}
            className="rounded-[var(--radius-xl)] bg-surface p-5 ring-1 ring-border transition hover:ring-accent/25 hover:shadow-[var(--shadow-glass)]"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Icon className="size-5" strokeWidth={1.65} />
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.12 }}
        className="mt-12 rounded-[var(--radius-xl)] border border-border bg-gradient-to-br from-sky-500/10 via-background to-violet-500/10 p-8 text-center dark:from-sky-500/15 dark:to-violet-500/15"
      >
        <Sparkles className="mx-auto size-8 text-accent" strokeWidth={1.5} />
        <p className="mt-4 text-[15px] font-semibold text-foreground">Start with Templates today</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-muted-foreground">
          Six official starters duplicate real project files into your workspace — no placeholder cards.
        </p>
        <Button variant="accent" size="lg" className="mt-6 gap-2" asChild>
          <Link href="/templates">
            Browse templates
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
