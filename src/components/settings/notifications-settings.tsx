"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bell, Zap, AlertCircle, Users, Brain, Rocket,
} from "lucide-react";
import { variants } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

const FUTURE_CAPABILITIES = [
  {
    icon: Zap,
    label: "Build alerts",
    description: "Instant notification when your app finishes generating or encounters an error.",
  },
  {
    icon: Rocket,
    label: "Deployment notifications",
    description: "Know the moment your app is live or when a deploy fails.",
  },
  {
    icon: AlertCircle,
    label: "Credit warnings",
    description: "Get notified before your credits run low so you never get blocked.",
  },
  {
    icon: Users,
    label: "Collaborator mentions",
    description: "Be alerted when teammates mention you in comments or discussions.",
  },
  {
    icon: Brain,
    label: "AI orchestration summaries",
    description: "Weekly digests of what your AI agents built and what they learned.",
  },
];

export function NotificationsSettings() {
  const [joined, setJoined] = React.useState(false);

  function handleJoinWaitlist() {
    setJoined(true);
    toast.success("You're on the waitlist — we'll notify you when notifications launch.");
  }

  return (
    <motion.div
      variants={variants.staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div
        variants={variants.fadeUp}
        className="rounded-[var(--radius-xl)] bg-surface px-6 py-10 ring-1 ring-border"
      >
        {/* Icon + heading */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border">
            <Bell className="size-7 text-muted-foreground/50" strokeWidth={1.35} />
          </div>
          <span className="mb-3 inline-flex rounded-full bg-muted/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
            In development
          </span>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
            Notification routing is coming soon
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            A full notification system is on the roadmap. Configure exactly what you hear about,
            how, and when — across email, in-app, and more.
          </p>
        </div>

        {/* Future capabilities grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {FUTURE_CAPABILITIES.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="flex gap-3 rounded-[var(--radius-lg)] bg-muted/40 px-4 py-3.5 ring-1 ring-border"
            >
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <Icon className="size-3.5 text-accent" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          {joined ? (
            <div className="flex items-center gap-2 rounded-full bg-positive/10 px-4 py-2 text-[13px] font-medium text-positive ring-1 ring-positive/20">
              <span className="size-1.5 rounded-full bg-positive" />
              You&apos;re on the waitlist
            </div>
          ) : (
            <Button variant="accent" size="lg" onClick={handleJoinWaitlist}>
              Join the waitlist
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
