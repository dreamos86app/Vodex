"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  ArrowUpRight,
  Zap,
  Users,
  Loader2,
  Globe,
  Lightbulb,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTimedLoading } from "@/lib/hooks/use-timed-loading";
import { Button } from "@/components/ui/button";
import { variants, whileHover, whileTap, transition } from "@/lib/motion";
import { cn } from "@/lib/utils";

const IDEA_CATEGORIES = ["All", "SaaS", "Mobile", "AI", "Commerce", "Social"] as const;
type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

const APP_IDEAS = [
  {
    id: "creator-crm",
    name: "Creator CRM",
    tagline: "Manage sponsors, deliverables, and payouts in one workspace.",
    category: "SaaS",
  },
  {
    id: "local-booking",
    name: "Local booking hub",
    tagline: "Appointments, reminders, and staff calendars for service businesses.",
    category: "SaaS",
  },
  {
    id: "fitness-coach",
    name: "Fitness coach app",
    tagline: "Programs, check-ins, and progress photos for coaching clients.",
    category: "Mobile",
  },
  {
    id: "ai-knowledge",
    name: "Team knowledge AI",
    tagline: "Ask questions over your docs with cited answers and access control.",
    category: "AI",
  },
  {
    id: "vendor-market",
    name: "Neighborhood marketplace",
    tagline: "Listings, messaging, and escrow-style checkout for local sellers.",
    category: "Commerce",
  },
  {
    id: "fan-community",
    name: "Fan community hub",
    tagline: "Channels, events, and member tiers for niche communities.",
    category: "Social",
  },
] as const;

interface PublicProject {
  id: string;
  name: string;
  description: string | null;
  gradient: string;
  category: string | null;
  updated_at: string;
}

function PublicAppCard({ project }: { project: PublicProject }) {
  return (
    <motion.article
      whileHover={whileHover.lift}
      whileTap={whileTap.press}
      transition={transition.card}
      className="group overflow-hidden rounded-[var(--radius-xl)] bg-glass ring-1 ring-border transition hover:ring-accent/30 hover:shadow-[var(--shadow-glass-hover)]"
      data-testid="explore-public-app-card"
    >
      <div
        className={cn(
          "relative min-h-[100px] bg-gradient-to-br",
          project.gradient || "from-sky-500/20 to-violet-500/20",
        )}
      >
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border backdrop-blur-md">
          <Globe className="size-2.5" />
          Public app
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-[15px] font-semibold text-foreground">{project.name}</h3>
        {project.description ? (
          <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{project.description}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          {project.category ? (
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {project.category}
            </span>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(project.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function IdeaCard({
  name,
  tagline,
  category,
}: {
  name: string;
  tagline: string;
  category: string;
}) {
  return (
    <div
      className="rounded-[var(--radius-xl)] bg-surface p-4 ring-1 ring-border transition hover:ring-accent/25"
      data-testid="explore-idea-card"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 text-amber-500" strokeWidth={1.75} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {category}
        </span>
      </div>
      <h3 className="mt-2 text-[15px] font-semibold text-foreground">{name}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{tagline}</p>
      <Link
        href={`/create?prompt=${encodeURIComponent(`Build: ${name}. ${tagline}`)}`}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent"
      >
        Try in Create <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}

function CommunityPublicApps() {
  const supabase = createClient();
  const [projects, setProjects] = React.useState<PublicProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const isLoading = useTimedLoading(loading, 800);

  React.useEffect(() => {
    supabase
      .from("projects")
      .select("id, name, description, gradient, category, updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!error) setProjects((data as PublicProject[]) ?? []);
        setLoading(false);
      });
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] bg-surface py-14 text-center ring-1 ring-border">
        <Users className="mx-auto size-7 text-accent" />
        <p className="mt-3 text-[15px] font-semibold text-foreground">No public apps yet</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-foreground">
          When builders publish apps publicly, they appear here for discovery.
        </p>
        <Button variant="accent" size="sm" className="mt-6" asChild>
          <Link href="/create">Start building</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <PublicAppCard key={p.id} project={p} />
      ))}
    </div>
  );
}

export function ExploreView() {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<IdeaCategory>("All");

  const filteredIdeas = APP_IDEAS.filter((item) => {
    const matchCat = category === "All" || item.category === category;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.tagline.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div className="relative mx-auto max-w-6xl" data-testid="explore-view">
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_8%,transparent),transparent_68%)] blur-3xl" />

      <motion.div variants={variants.fadeUp} initial="hidden" animate="show">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">EXPLORE</p>
        <h1 className="mt-3 text-balance text-[clamp(1.75rem,3.5vw,2.6rem)] font-semibold tracking-[-0.055em] text-foreground">
          Discover apps & ideas
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">
          Browse public community apps and app ideas to inspire your next build. Official starters live on{" "}
          <Link href="/templates" className="font-medium text-accent hover:underline">
            Templates
          </Link>
          .
        </p>
      </motion.div>

      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.06 }}
        className="mt-8"
      >
        <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
          PUBLIC COMMUNITY APPS
        </p>
        <CommunityPublicApps />
      </motion.div>

      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.12 }}
        className="mt-14"
        data-testid="explore-ideas-section"
      >
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
            APP IDEAS
          </p>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search ideas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-[var(--radius-md)] bg-surface pl-9 pr-4 text-[13px] ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {IDEA_CATEGORIES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCategory(t)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition",
                category === t
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground ring-1 ring-border",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIdeas.map((item) => (
            <IdeaCard key={item.id} {...item} />
          ))}
        </div>
      </motion.div>

      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.18 }}
        className="mt-14 rounded-[var(--radius-xl)] border border-border bg-surface/80 p-6 text-center"
      >
        <p className="text-[13px] text-muted-foreground">
          Want a full starter codebase? Use an official template — real files, not mock cards.
        </p>
        <Button variant="accent" size="sm" className="mt-4 gap-1.5" asChild>
          <Link href="/templates">
            <Zap className="size-3.5" />
            Open Templates
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
