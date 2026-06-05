"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plug, LayoutGrid, ArrowRight, ExternalLink } from "lucide-react";
import { variants } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { IntegrationShowcaseGrid } from "@/components/marketing/integrations-showcase";

export function IntegrationsSettings() {
  return (
    <motion.div
      variants={variants.staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Explanation card */}
      <motion.div
        variants={variants.fadeUp}
        className="rounded-[var(--radius-xl)] bg-surface ring-1 ring-border overflow-hidden"
      >
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
            <Plug className="size-7 text-accent" strokeWidth={1.5} />
          </div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            Integrations are app-scoped
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Each app you build has its own integrations, secrets, and connected services.
            To connect Supabase, Stripe, GitHub, or other services, open the dashboard for
            the specific app you want to configure.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
            <Button variant="accent" size="md" asChild>
              <Link href="/projects">
                <LayoutGrid className="size-4" strokeWidth={1.75} />
                View my apps
              </Link>
            </Button>
            <Button variant="outline" size="md" asChild>
              <Link href="/">
                <ArrowRight className="size-4" strokeWidth={1.75} />
                Create a new app
              </Link>
            </Button>
          </div>
        </div>

        {/* Integration examples */}
        <div className="border-t border-border bg-muted/30 px-6 py-5">
          <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Available in each app dashboard
          </p>
          <IntegrationShowcaseGrid dense />
        </div>
      </motion.div>

      {/* DreamOS API keys note */}
      <motion.div
        variants={variants.fadeUp}
        className="rounded-[var(--radius-xl)] bg-surface px-5 py-4 ring-1 ring-border"
      >
        <div className="flex items-start gap-3">
          <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <p className="text-[13px] font-medium text-foreground">Vodex Platform API Keys</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              If you are looking for API keys to access Vodex programmatically, those are
              in{" "}
              <Link href="/settings/api-keys" className="text-accent hover:underline underline-offset-2">
                Settings → API Keys
              </Link>
              .
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
