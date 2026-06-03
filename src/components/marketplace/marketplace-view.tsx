"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search, Star, ArrowUpRight, Sparkles, ExternalLink,
  Smartphone, LayoutDashboard, Users,
} from "lucide-react";
import { TemplateMockup, categoryToVariant } from "@/components/ui/template-mockup";
import { Button } from "@/components/ui/button";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";

// ─── Official Templates ───────────────────────────────────────────────────────
// These are real, installable templates that Vodex can scaffold via AI.

interface Template {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: string;
  frameworks: string[];
  integrations: string[];
  gradient: string;
  icon: React.ElementType;
  complexity: "Beginner" | "Intermediate" | "Advanced";
  estimatedMinutes: number;
}

// Three carefully designed official templates.
// "Use template" navigates to /create with a structured generation prompt
// so the AI builds the full application architecture from scratch.
const OFFICIAL_TEMPLATES: Template[] = [
  {
    id: "saas-starter",
    name: "SaaS Starter",
    description:
      "A complete production-ready SaaS with Supabase auth, Stripe subscription billing, a credit system, usage dashboard, settings, and AI features. Fully deployable from day one.",
    tags: ["Auth", "Billing", "AI", "Dashboard"],
    category: "SaaS",
    frameworks: ["Next.js 16", "Supabase", "Stripe"],
    integrations: ["Supabase Auth", "Stripe Billing", "AI SDK"],
    gradient: "from-blue-500/20 via-indigo-500/10 to-violet-500/15",
    icon: Sparkles,
    complexity: "Advanced",
    estimatedMinutes: 8,
  },
  {
    id: "mobile-app-starter",
    name: "Mobile App Starter",
    description:
      "A polished mobile-first application with bottom navigation, native-feeling animations, push notification support, user profiles, onboarding flow, and offline-first data sync.",
    tags: ["Mobile", "Offline", "Animations", "Profiles"],
    category: "Mobile",
    frameworks: ["Next.js", "Capacitor"],
    integrations: ["Supabase", "Push Notifications"],
    gradient: "from-emerald-500/20 via-teal-500/10 to-cyan-500/15",
    icon: Smartphone,
    complexity: "Intermediate",
    estimatedMinutes: 5,
  },
  {
    id: "ai-dashboard-starter",
    name: "AI Dashboard Starter",
    description:
      "An intelligent analytics dashboard with real-time charts, AI-powered insights, data tables, date range filters, export functionality, and role-based access control.",
    tags: ["Analytics", "AI Insights", "Real-time", "Charts"],
    category: "Dashboard",
    frameworks: ["Next.js", "Supabase"],
    integrations: ["Supabase Realtime", "AI SDK"],
    gradient: "from-orange-500/20 via-amber-500/10 to-yellow-500/15",
    icon: LayoutDashboard,
    complexity: "Intermediate",
    estimatedMinutes: 5,
  },
];

const CATEGORIES = ["All", "SaaS", "Mobile", "Dashboard"];

const COMPLEXITY_COLORS: Record<Template["complexity"], string> = {
  Beginner: "text-positive bg-positive/10 ring-positive/20",
  Intermediate: "text-amber-500 bg-amber-500/10 ring-amber-500/20",
  Advanced: "text-accent bg-accent/10 ring-accent/20",
};

// ─── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onUse }: { template: Template; onUse: (t: Template) => void }) {
  const Icon = template.icon;
  return (
    <motion.div
      variants={variants.staggerItem}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-border transition hover:ring-accent/30 hover:shadow-[var(--shadow-glass)]"
    >
      {/* App preview mockup */}
      <div className="relative min-h-[120px] overflow-hidden">
        <TemplateMockup
          variant={categoryToVariant(template.id)}
          gradient={template.gradient}
          className="absolute inset-0"
        />
        <div className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-lg bg-black/20 backdrop-blur-sm ring-1 ring-white/20">
          <Icon className="size-4 text-white/80" strokeWidth={1.75} />
        </div>
        <div className="absolute right-3 top-3">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", COMPLEXITY_COLORS[template.complexity])}>
            {template.complexity}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-[13.5px] font-semibold tracking-tight text-foreground">{template.name}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">{template.description}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/50">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Star className="size-3 text-amber-400 fill-amber-400" strokeWidth={0} />
            Official
            <span className="ml-1 text-muted-foreground/50">·</span>
            <span>~{template.estimatedMinutes}m to generate</span>
          </div>
          <Button
            variant="accent"
            size="xs"
            onClick={() => onUse(template)}
            className="gap-1"
          >
            Use template
            <ArrowUpRight className="size-3" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Community empty state ─────────────────────────────────────────────────────

function CommunityEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] bg-surface py-16 text-center ring-1 ring-border">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
        <Users className="size-7 text-accent" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold tracking-tight text-foreground">No community apps yet</p>
      <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
        When builders publish their apps, they&apos;ll appear here. Build something with Vodex and be the first.
      </p>
      <Button variant="accent" size="sm" className="mt-6 gap-1.5" asChild>
        <Link href="/create">
          <Sparkles className="size-3.5" strokeWidth={1.75} />
          Start building
        </Link>
      </Button>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

type MarketplaceTab = "Official Templates" | "Community Apps";
const TABS: MarketplaceTab[] = ["Official Templates", "Community Apps"];

export function MarketplaceView() {
  const [activeTab, setActiveTab] = React.useState<MarketplaceTab>("Official Templates");
  const [category, setCategory] = React.useState("All");
  const [search, setSearch] = React.useState("");

  const filtered = OFFICIAL_TEMPLATES.filter((t) => {
    const matchCat = category === "All" || t.category === category;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function handleUse(template: Template) {
    // Navigate to /create with a structured generation prompt so the AI builds the full app.
    const prompt = `BUILD: ${template.name}\n\n${template.description}\n\nStack: ${template.frameworks.join(", ")}\nIntegrations: ${template.integrations.join(", ")}\n\nGenerate the complete application with all routes, components, database schema, API handlers, and styling. Make it production-ready, beautiful, and fully functional.`;
    window.location.href = `/create?prompt=${encodeURIComponent(prompt)}`;
  }

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-7xl">
      <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_8%,transparent),transparent_68%)] blur-3xl" />

      <motion.div variants={variants.fadeUp} initial="hidden" animate="show">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">MARKETPLACE</p>
        <h1 className="mt-3 text-[clamp(1.75rem,3.5vw,2.4rem)] font-semibold tracking-[-0.055em] text-foreground">
          Templates & Extensions
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Official starting points for every kind of app.
        </p>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-border w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setActiveTab(tab); setCategory("All"); }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Community empty state */}
      {activeTab === "Community Apps" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" className="mt-8">
          <CommunityEmptyState />
        </motion.div>
      )}

      {/* Templates / Kits */}
      {activeTab !== "Community Apps" && (
        <>
          <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.05 }} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.55} />
              <input
                type="search"
                placeholder="Search templates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-[var(--radius-md)] bg-surface pl-9 pr-4 text-[13px] text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>
            {activeTab === "Official Templates" && (
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-medium transition",
                      category === c
                        ? "bg-foreground text-background"
                        : "bg-surface text-muted-foreground ring-1 ring-border hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {filtered.length === 0 ? (
            <div className="mt-8 flex flex-col items-center py-14 text-center">
              <p className="text-[14px] font-medium text-foreground">No templates match your search</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Try a different keyword or category</p>
            </div>
          ) : (
            <motion.div
              variants={variants.staggerContainer}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.1 }}
              className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={handleUse} />
              ))}
            </motion.div>
          )}

          {/* Official badge */}
          <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.2 }} className="vodex-pre-footer-spacing mt-8 flex items-center gap-2.5 rounded-[var(--radius-lg)] bg-surface px-4 py-3 ring-1 ring-border dark:bg-surface/80 dark:ring-border/90">
            <Star className="size-4 fill-amber-400 text-amber-400" strokeWidth={0} />
            <p className="text-[12px] text-muted-foreground">
              All templates are maintained by the Vodex team. Each one generates a complete, production-ready codebase.
            </p>
            <a
              href="https://github.com/vodex-labs"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[12px] text-accent hover:underline shrink-0"
            >
              View source <ExternalLink className="size-3" />
            </a>
          </motion.div>
        </>
      )}
    </div>
  );
}
