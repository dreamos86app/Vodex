"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PublicTrustStat } from "@/lib/evidence/public-trust-types";

function StatTile({
  stat,
  index,
  active,
}: {
  stat: PublicTrustStat;
  index: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-background/80 p-5",
        "shadow-[0_20px_48px_-36px_hsl(var(--accent)/0.2)] ring-1 ring-border/50",
        "hover:border-accent/30 hover:shadow-[0_24px_56px_-32px_hsl(var(--accent)/0.28)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-violet-500/5 opacity-0 transition group-hover:opacity-100" />
      <p className="relative text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tabular-nums tracking-tight text-foreground">
        {stat.value}
      </p>
      <p className="relative mt-1 text-[13px] font-medium text-foreground">{stat.label}</p>
      {stat.detail ? (
        <p className="relative mt-1 text-[11px] text-muted-foreground">{stat.detail}</p>
      ) : null}
    </motion.div>
  );
}

export function PublicDreamOsNumbers({ stats }: { stats: PublicTrustStat[] }) {
  const ref = React.useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section
      ref={ref}
      data-testid="dreamos-public-numbers"
      className="mx-auto mt-20 max-w-5xl"
    >
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Trust & quality</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground sm:text-[30px]">
          DreamOS86 in numbers
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-[14px] text-muted-foreground">
          Real benchmarks and verification — no inflated marketing stats.
        </p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, i) => (
          <StatTile key={stat.label} stat={stat} index={i} active={inView} />
        ))}
      </div>
    </section>
  );
}
