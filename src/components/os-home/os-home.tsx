"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Zap,
  Sparkles,
  Plus,
  Clock,
  LayoutGrid,
  MessageCircle,
  Pencil,
  TrendingUp,
  Users,
  Rocket,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCreditsStore } from "@/lib/stores/credits-store";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { CreationMode } from "@/lib/creation/models";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentProject {
  id: string;
  name: string;
  gradient: string;
  status: string;
  updated_at: string;
  preview_url: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GREETING = (() => {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Night owl mode";
})();

const TEMPLATES = [
  { label: "SaaS Dashboard", prompt: "Build a premium SaaS dashboard with analytics, team management, billing, and role-based access control.", icon: "📊", gradient: "from-blue-500/20 to-violet-500/20" },
  { label: "AI Chatbot", prompt: "Create a production-grade AI chatbot platform with streaming responses, conversation history, and model selection.", icon: "🤖", gradient: "from-violet-500/20 to-pink-500/20" },
  { label: "E-commerce", prompt: "Build a modern e-commerce platform with product catalog, cart, checkout, Stripe payments, and order tracking.", icon: "🛍️", gradient: "from-emerald-500/20 to-cyan-500/20" },
  { label: "Social App", prompt: "Create a social platform with profiles, real-time feed, following, likes, comments, and notifications.", icon: "💬", gradient: "from-amber-500/20 to-orange-500/20" },
  { label: "Portfolio", prompt: "Build a stunning developer portfolio with animated hero, project showcase, skills section, and contact form.", icon: "✨", gradient: "from-pink-500/20 to-rose-500/20" },
  { label: "CRM", prompt: "Create an AI-powered CRM with contact management, deal pipeline, activity tracking, and automated follow-ups.", icon: "📋", gradient: "from-cyan-500/20 to-blue-500/20" },
];

const MODES: Array<{ id: CreationMode; label: string; desc: string; icon: React.ElementType; accent: string }> = [
  { id: "discuss", label: "Discuss", desc: "Plan, explore, debug", icon: MessageCircle, accent: "text-blue-500" },
  { id: "edit", label: "Edit", desc: "Surgical precision", icon: Pencil, accent: "text-amber-500" },
  { id: "build", label: "Build", desc: "Full system generation", icon: Zap, accent: "text-violet-500" },
];

const COMMUNITY_HIGHLIGHTS = [
  { name: "AI Finance Tracker", author: "Ryo Yamamoto", stars: 284, gradient: "from-emerald-400 to-cyan-500" },
  { name: "Real-time Collab Board", author: "Aria Chen", stars: 197, gradient: "from-violet-400 to-purple-600" },
  { name: "Crypto Portfolio Pro", author: "Marcus Klein", stars: 452, gradient: "from-amber-400 to-orange-500" },
];

const STATUS_DOT: Record<string, string> = {
  live: "bg-green-400 animate-pulse",
  building: "bg-accent animate-pulse",
  staging: "bg-amber-400",
  draft: "bg-muted-foreground/40",
  error: "bg-destructive",
};

// ─── Ambient orbs ─────────────────────────────────────────────────────────────

function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -top-32 -left-20 size-[600px] rounded-full bg-gradient-radial from-accent/[0.07] to-transparent blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[40%] -right-32 size-[500px] rounded-full bg-gradient-radial from-violet-500/[0.05] to-transparent blur-3xl"
        animate={{ x: [0, -25, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 5 }}
      />
      <motion.div
        className="absolute -bottom-20 left-1/3 size-[400px] rounded-full bg-gradient-radial from-blue-500/[0.04] to-transparent blur-3xl"
        animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}

// ─── Quick create bar ─────────────────────────────────────────────────────────

function QuickCreateBar() {
  const router = useRouter();
  const [input, setInput] = React.useState("");
  const [mode, setMode] = React.useState<CreationMode>("build");

  function launch() {
    const q = input.trim();
    if (!q) return;
    router.push(`/create?prompt=${encodeURIComponent(q)}&mode=${mode}`);
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="relative overflow-hidden rounded-2xl bg-surface ring-1 ring-border shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] transition focus-within:ring-accent/30 focus-within:shadow-[0_12px_40px_-8px_rgba(30,107,255,0.15)]">
        {/* Mode selector */}
        <div className="flex items-center gap-1 border-b border-border/60 px-3 py-1.5">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition",
                  mode === m.id
                    ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-raised",
                )}
              >
                <Icon className={cn("size-3", mode === m.id ? "text-accent" : m.accent)} strokeWidth={1.75} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Input */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              launch();
            }
          }}
          placeholder={
            mode === "build"
              ? "Describe the app you want to build. DreamOS86 generates routes, backend, UI, and runtime…"
              : mode === "discuss"
                ? "Ask anything. Plan architecture, explore ideas, or diagnose a problem…"
                : "Describe an edit. Choose scope, then describe the change precisely…"
          }
          rows={2}
          className="w-full resize-none bg-transparent px-4 pb-2 pt-3 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
          <p className="text-[11px] text-muted-foreground/50">Enter to launch · Shift+Enter for new line</p>
          <button
            type="button"
            onClick={launch}
            disabled={!input.trim()}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-[13px] font-semibold transition",
              input.trim()
                ? mode === "build"
                  ? "bg-gradient-to-r from-accent to-violet-500 text-white shadow-[0_4px_20px_-4px_rgba(30,107,255,0.4)] hover:opacity-90 active:scale-[0.98]"
                  : "bg-accent text-white hover:bg-accent/90 active:scale-[0.98]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Zap className="size-3.5" strokeWidth={2} />
            Launch
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recent apps ──────────────────────────────────────────────────────────────

function RecentApps({ projects }: { projects: RecentProject[] }) {
  if (projects.length === 0) return null;

  return (
    <section className="w-full max-w-5xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-muted-foreground/60" strokeWidth={1.75} />
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Continue building
          </span>
        </div>
        <Link href="/projects" className="flex items-center gap-1 text-[11.5px] text-accent transition hover:underline">
          View all <ArrowRight className="size-3" strokeWidth={2} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {projects.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
          >
            <Link
              href={`/projects/${p.id}`}
              className="group flex min-w-[200px] items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-border transition hover:ring-accent/30 hover:shadow-sm"
            >
              <div className={cn("size-9 shrink-0 rounded-xl bg-gradient-to-br", p.gradient)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("size-1.5 rounded-full", STATUS_DOT[p.status] ?? "bg-muted-foreground/40")} />
                  <span className="text-[11px] capitalize text-muted-foreground">{p.status}</span>
                </div>
              </div>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/30 transition group-hover:text-accent/60" strokeWidth={2} />
            </Link>
          </motion.div>
        ))}

        {/* New app tile */}
        <Link
          href="/create"
          className="flex min-w-[160px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-center transition hover:border-accent/40 hover:bg-accent/5"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent/10">
            <Plus className="size-4 text-accent" strokeWidth={2} />
          </div>
          <span className="text-[11.5px] font-medium text-muted-foreground">New app</span>
        </Link>
      </div>
    </section>
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────

function TemplateGrid() {
  const router = useRouter();

  return (
    <section className="w-full max-w-5xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-muted-foreground/60" strokeWidth={1.75} />
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Start from a template
          </span>
        </div>
        <Link href="/templates" className="flex items-center gap-1 text-[11.5px] text-accent transition hover:underline">
          All templates <ArrowRight className="size-3" strokeWidth={2} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {TEMPLATES.map((t, i) => (
          <motion.button
            key={t.label}
            type="button"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.18 }}
            onClick={() => router.push(`/create?prompt=${encodeURIComponent(t.prompt)}`)}
            className={cn(
              "group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl bg-gradient-to-br p-3.5 ring-1 ring-border transition hover:ring-accent/30 hover:shadow-md",
              t.gradient,
            )}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="text-[12.5px] font-semibold text-foreground">{t.label}</span>
            <ArrowRight className="absolute right-2.5 top-2.5 size-3.5 text-foreground/20 transition group-hover:text-accent/60" strokeWidth={2} />
          </motion.button>
        ))}
      </div>
    </section>
  );
}

// ─── Community highlights ─────────────────────────────────────────────────────

function CommunityHighlights() {
  return (
    <section className="w-full max-w-5xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="size-3.5 text-muted-foreground/60" strokeWidth={1.75} />
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            From the community
          </span>
        </div>
        <Link href="/community" className="flex items-center gap-1 text-[11.5px] text-accent transition hover:underline">
          Explore <ArrowRight className="size-3" strokeWidth={2} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COMMUNITY_HIGHLIGHTS.map((app, i) => (
          <motion.div
            key={app.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            className="group cursor-pointer rounded-xl bg-surface ring-1 ring-border transition hover:ring-accent/30 hover:shadow-sm overflow-hidden"
          >
            <div className={cn("h-20 w-full bg-gradient-to-br opacity-80", app.gradient)} />
            <div className="p-3">
              <p className="text-[13px] font-semibold text-foreground">{app.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">by {app.author}</p>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>⭐</span>
                <span>{app.stars}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Platform stats bar ───────────────────────────────────────────────────────

function PlatformStats({ appCount }: { appCount: number }) {
  const credits = useCreditsStore((s) => s.remaining);
  const hydrated = useHydrated();

  return (
    <div className="flex items-center gap-4 text-[11.5px] text-muted-foreground/70">
      <span className="flex items-center gap-1.5">
        <LayoutGrid className="size-3" strokeWidth={1.75} />
        {appCount} app{appCount !== 1 ? "s" : ""}
      </span>
      {hydrated && (
        <span className="flex items-center gap-1.5">
          <Zap className="size-3 text-accent/70" strokeWidth={1.75} />
          {credits} credits
        </span>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface OsHomeProps {
  recentProjects: RecentProject[];
}

export function OsHome({ recentProjects }: OsHomeProps) {
  const { profile } = useAuthStore();
  const firstName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? null;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-y-auto">
      <AmbientOrbs />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 pb-20 pt-12 sm:px-6">

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full max-w-2xl flex-col items-center text-center"
        >
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground sm:text-[32px]">
            {GREETING}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            What are you building today?
          </p>
          <div className="mt-2">
            <PlatformStats appCount={recentProjects.length} />
          </div>
        </motion.div>

        {/* Quick create bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="w-full max-w-2xl"
        >
          <QuickCreateBar />
        </motion.div>

        {/* Recent apps */}
        <AnimatePresence>
          {recentProjects.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="w-full"
            >
              <RecentApps projects={recentProjects} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Templates */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="w-full"
        >
          <TemplateGrid />
        </motion.div>

        {/* Community */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full"
        >
          <CommunityHighlights />
        </motion.div>

        {/* Platform quick links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex flex-wrap items-center justify-center gap-2 w-full max-w-2xl"
        >
          {[
            { href: "/projects", icon: LayoutGrid, label: "All apps" },
            { href: "/community", icon: Users, label: "Community" },
            { href: "/templates", icon: Sparkles, label: "Templates" },
            { href: "/marketplace", icon: Globe, label: "Marketplace" },
            { href: "/pricing", icon: Rocket, label: "Upgrade" },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[12px] font-medium text-muted-foreground ring-1 ring-border transition hover:bg-surface-raised hover:text-foreground hover:ring-accent/20"
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
