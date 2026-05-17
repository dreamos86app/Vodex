"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  variant?: "accent" | "secondary" | "ghost";
};

export type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  hints?: string[];
  quickActions?: EmptyStateAction[];
  badge?: string;
  className?: string;
};

function ActionButton({
  action,
  isPrimary = false,
}: {
  action: EmptyStateAction;
  isPrimary?: boolean;
}) {
  const variant = action.variant ?? (isPrimary ? "accent" : "secondary");
  const inner = (
    <Button variant={variant} size="lg" type="button" onClick={action.onClick} className={action.icon ? "gap-1.5" : undefined}>
      {action.icon}
      {action.label}
    </Button>
  );

  if (action.href) {
    return (
      <Link href={action.href} tabIndex={-1}>
        <Button variant={variant} size="lg" type="button" className={action.icon ? "gap-1.5" : undefined}>
          {action.icon}
          {action.label}
        </Button>
      </Link>
    );
  }
  return inner;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  hints,
  quickActions,
  badge,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-xl)] bg-surface px-8 py-14 text-center shadow-[var(--shadow-card)] ring-1 ring-border",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
        {icon}
      </div>

      {badge && (
        <span className="mt-4 inline-flex rounded-full bg-muted/70 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground ring-1 ring-border">
          {badge}
        </span>
      )}

      <h3 className={cn("text-[17px] font-semibold tracking-[-0.02em] text-foreground", badge ? "mt-3" : "mt-6")}>
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        {description}
      </p>

      {hints && hints.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-left max-w-xs">
          {hints.map((hint) => (
            <li key={hint} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent/60" />
              {hint}
            </li>
          ))}
        </ul>
      )}

      {(action || secondaryAction) && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {action && <ActionButton action={action} isPrimary />}
          {secondaryAction && <ActionButton action={secondaryAction} />}
        </div>
      )}

      {quickActions && quickActions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {quickActions.map((qa) => (
            <ActionButton key={qa.label} action={qa} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
