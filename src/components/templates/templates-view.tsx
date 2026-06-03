"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  ArrowUpRight,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { templates, type Template, type TemplateCategory } from "@/lib/data";
import { TemplateMockup, categoryToVariant } from "@/components/ui/template-mockup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { variants, whileHover, whileTap, transition } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { useTimedLoading } from "@/lib/hooks/use-timed-loading";
import { Loader2, Upload, Users, Package } from "lucide-react";
import { toast } from "@/lib/toast";

// No fake usage statistics — templates show honest metadata only

const categories: { id: TemplateCategory | "all"; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "saas",         label: "SaaS" },
  { id: "ai",           label: "AI" },
  { id: "marketplace",  label: "Marketplace" },
  { id: "social",       label: "Social" },
  { id: "finance",      label: "Finance" },
  { id: "productivity", label: "Productivity" },
  { id: "portfolio",    label: "Portfolio" },
  { id: "mobile",       label: "Mobile" },
  { id: "community",    label: "Community" },
  { id: "enterprise",   label: "Enterprise" },
];

const complexityLabel = {
  simple:   { label: "Simple",   color: "text-positive bg-positive-muted" },
  medium:   { label: "Medium",   color: "text-accent bg-accent-muted" },
  advanced: { label: "Advanced", color: "text-warning bg-warning-muted" },
};

const TEMPLATE_LOADING_MSG = "Creating your template workspace…";

async function activateOfficialTemplate(template: Template): Promise<void> {
  const res = await fetch(`/api/templates/${encodeURIComponent(template.id)}/use`, {
    method: "POST",
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    builderUrl?: string;
    projectId?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Could not create template workspace");
  }
  window.location.href = data.builderUrl ?? `/apps/${data.projectId}/builder`;
}

// ─── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  featured,
  using,
}: {
  template: Template;
  onUse: (template: Template) => void;
  featured?: boolean;
  using?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  const cx = complexityLabel[template.complexity];

  return (
    <motion.article
      whileHover={whileHover.lift}
      whileTap={whileTap.press}
      transition={transition.card}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={cn("h-full", featured && "sm:col-span-2")}
    >
      <div
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] p-px",
          "bg-gradient-to-b from-white/70 via-white/25 to-white/5 shadow-[var(--shadow-glass)]",
          "dark:from-white/10 dark:via-white/[0.03] dark:to-transparent",
          "transition-shadow duration-300 hover:shadow-[var(--shadow-glass-hover)]",
        )}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-xl)-1px)] glass-border bg-glass">
          {/* Preview area — app UI mockup */}
          <div
            className={cn(
              "relative overflow-hidden",
              featured ? "min-h-[200px]" : "min-h-[140px]",
            )}
          >
            <TemplateMockup
              variant={categoryToVariant(template.category)}
              gradient={template.gradient}
              className="absolute inset-0"
            />

            {/* Badges */}
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="rounded-full bg-surface/75 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/60 backdrop-blur-md dark:bg-surface/40">
                {categories.find((c) => c.id === template.category)?.label ?? template.category}
              </span>
              {template.popular && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-500/20 backdrop-blur-md dark:text-amber-400">
                  <Star className="size-2.5 fill-current" />
                  Popular
                </span>
              )}
              {template.new && (
                <span className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent ring-1 ring-accent/20 backdrop-blur-md">
                  New
                </span>
              )}
            </div>

            {/* Hover overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center gap-3 bg-foreground/8 backdrop-blur-[1px]"
            >
              <button
                type="button"
                disabled={using}
                onClick={() => onUse(template)}
                className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background shadow-lg transition hover:scale-105 disabled:opacity-60"
              >
                {using ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Sparkles className="size-4" strokeWidth={1.75} />
                )}
                {using ? "Creating…" : "Launch template"}
              </button>
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-full bg-surface/80 px-3.5 py-2 text-[13px] font-semibold text-foreground shadow-lg backdrop-blur-md ring-1 ring-border transition hover:scale-105"
              >
                Preview
              </Link>
            </motion.div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-4">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={cn(
                  "font-semibold tracking-[-0.03em] text-foreground",
                  featured ? "text-[18px]" : "text-[15px]",
                )}
              >
                {template.name}
              </h3>
              <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", cx.color)}>
                {cx.label}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {template.description}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/50"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
              <button
                type="button"
                disabled={using}
                onClick={() => onUse(template)}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent transition group-hover:gap-1.5 disabled:opacity-50"
              >
                {using ? "Creating…" : "Use template"}
                <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
              </button>
              <Link
                href="/"
                className="text-[12px] text-muted-foreground transition hover:text-foreground"
              >
                Preview
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// ─── Featured Banner Card ──────────────────────────────────────────────────────

function FeaturedCard({
  template,
  onUse,
  using,
}: {
  template: Template;
  onUse: (template: Template) => void;
  using?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <motion.article
      whileHover={whileHover.lift}
      whileTap={whileTap.press}
      transition={transition.card}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-xl)] p-px",
          "bg-gradient-to-b from-white/70 via-white/25 to-white/5 shadow-[var(--shadow-glass)]",
          "dark:from-white/10 dark:via-white/[0.03] dark:to-transparent",
          "transition-shadow duration-300 hover:shadow-[var(--shadow-glass-hover)]",
        )}
      >
        <div className={cn("relative overflow-hidden rounded-[calc(var(--radius-xl)-1px)] bg-gradient-to-br min-h-[180px]", template.gradient)}>
          {/* Light overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgba(255,255,255,0.9),transparent_55%)] opacity-90 dark:opacity-15" />
          <div className="pointer-events-none absolute inset-0 ds-preview-grid opacity-20" />

          {/* Content overlay */}
          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground backdrop-blur-md ring-1 ring-border/60">
                    FEATURED
                  </span>
                  {template.popular && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/20 backdrop-blur-md dark:text-amber-300">
                      <Star className="size-2.5 fill-current" />
                      Popular
                    </span>
                  )}
                  {template.new && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/20 backdrop-blur-md">
                      New
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-[22px] font-bold tracking-[-0.04em] text-foreground">
                  {template.name}
                </h3>
                <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-foreground/70">
                  {template.description}
                </p>
                <p className="mt-2 text-[12px] text-foreground/55">Official template · Vodex</p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button
                variant="accent"
                size="sm"
                disabled={using}
                onClick={() => onUse(template)}
              >
                {using ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Sparkles className="size-3.5" strokeWidth={1.75} />
                )}
                {using ? "Creating…" : "Use template"}
              </Button>
              <Link
                href="/"
                className="text-[13px] font-medium text-foreground/70 transition hover:text-foreground"
              >
                Preview →
              </Link>
            </div>
          </div>

          {/* Hover glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 bg-foreground/5"
          />
        </div>
      </div>
    </motion.article>
  );
}

// ─── Community templates (real DB-backed) ────────────────────────────────────

interface CommunityTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  uses_count: number;
  tags: string[];
  created_at: string;
}

function CommunityTemplatesSection() {
  const supabase = createClient();
  const [items, setItems] = React.useState<CommunityTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const isLoading = useTimedLoading(loading, 1000);

  React.useEffect(() => {
    supabase
      .from("templates")
      .select("id, name, description, category, uses_count, tags, created_at")
      .order("uses_count", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error) setItems((data as CommunityTemplate[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div
      variants={variants.fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: 0.35 }}
      className="vodex-pre-footer-spacing mt-16"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-foreground">
            Community Templates
          </h3>
          <p className="text-[12.5px] text-muted-foreground">
            Published by builders in the Vodex community.
          </p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-[12px] font-medium text-muted-foreground ring-1 ring-border transition hover:text-foreground hover:ring-accent/30"
        >
          <Upload className="size-3.5" strokeWidth={1.75} />
          Publish yours
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface/50 px-8 py-12 text-center ring-1 ring-border/60">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
            <Package className="size-5 text-accent" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground">No community templates yet</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Be the first to publish a template to the Vodex community.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/create"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-accent/90"
            >
              <Sparkles className="size-3.5" strokeWidth={1.75} />
              Build and publish
            </Link>
            <Link
              href="/community"
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-[12.5px] font-medium text-muted-foreground ring-1 ring-border transition hover:text-foreground"
            >
              <Users className="size-3.5" strokeWidth={1.75} />
              Browse community
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-[var(--radius-xl)] bg-surface p-4 ring-1 ring-border transition hover:ring-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-foreground">{t.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Official template</p>
                </div>
                <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                  {t.uses_count} uses
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-2">{t.description}</p>
              {t.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => { window.location.href = `/create?template=${t.id}`; }}
                className="mt-auto flex items-center gap-1 text-[12.5px] font-semibold text-accent transition hover:underline"
              >
                Use template <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function TemplatesView() {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<TemplateCategory | "all">("all");
  const [loadingTemplateId, setLoadingTemplateId] = React.useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = React.useState<string | null>(null);

  const handleUseTemplate = React.useCallback(async (template: Template) => {
    setLoadingTemplateId(template.id);
    setLoadingMessage(TEMPLATE_LOADING_MSG);
    try {
      await activateOfficialTemplate(template);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not use template";
      toast.error(msg);
      setLoadingTemplateId(null);
      setLoadingMessage(null);
    }
  }, []);

  const filtered = React.useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchCat = category === "all" || t.category === category;
      return matchSearch && matchCat;
    });
  }, [search, category]);

  const featured = filtered.filter((t) => t.popular).slice(0, 3);
  const popular = filtered.filter((t) => t.popular);
  const others = filtered.filter((t) => !t.popular);

  const isFiltered = search || category !== "all";

  return (
    <div className="relative mx-auto max-w-6xl">
      {loadingMessage ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          data-testid="template-workspace-loading"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-8 py-6 shadow-xl ring-1 ring-border">
            <Loader2 className="size-8 animate-spin text-accent" strokeWidth={1.75} />
            <p className="text-[14px] font-semibold text-foreground">{loadingMessage}</p>
          </div>
        </div>
      ) : null}
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_68%)] blur-3xl" />

      {/* Header */}
      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        className="relative"
      >
        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">TEMPLATES</p>
        <h1 className="mt-3 text-balance text-[clamp(1.85rem,3.5vw,2.6rem)] font-semibold tracking-[-0.055em] text-foreground">
          Begin with atmosphere
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          {templates.length} production-ready templates across every category.
          Remix freely — the scaffolding stays invisible.
        </p>
      </motion.div>

      {/* Search + filter */}
      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.06 }}
        className="relative mt-8 flex flex-col gap-4"
      >
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.55}
          />
          <input
            type="search"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-[var(--radius-md)] bg-surface pl-9 pr-4 text-[13px] text-foreground ring-1 ring-border placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition",
                category === cat.id
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground ring-1 ring-border hover:text-foreground",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Featured section — only shown when not actively filtering */}
      {!isFiltered && featured.length > 0 && (
        <motion.div
          variants={variants.fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.1 }}
          className="relative mt-10"
        >
          <div className="mb-5 flex items-center gap-2">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">FEATURED</p>
            <Star className="size-3 fill-amber-400 text-amber-400" />
          </div>
          <motion.div
            variants={variants.staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {featured.map((t) => (
              <motion.div key={t.id} variants={variants.staggerItem}>
                <FeaturedCard
                  template={t}
                  onUse={handleUseTemplate}
                  using={loadingTemplateId === t.id}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Popular */}
      {popular.length > 0 && (
        <motion.div
          variants={variants.fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: isFiltered ? 0.1 : 0.18 }}
          className="relative mt-12"
        >
          <div className="mb-5 flex items-center gap-2">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">POPULAR</p>
            <Zap className="size-3 text-amber-500" strokeWidth={2} />
          </div>
          <motion.div
            variants={variants.staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {popular.map((t, i) => (
              <motion.div
                key={t.id}
                variants={variants.staggerItem}
                className={i === 0 ? "sm:col-span-2" : ""}
              >
                <TemplateCard
                  template={t}
                  onUse={handleUseTemplate}
                  featured={i === 0}
                  using={loadingTemplateId === t.id}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* All templates */}
      {others.length > 0 && (
        <motion.div
          variants={variants.fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: isFiltered ? 0.15 : 0.24 }}
          className="relative mt-12"
        >
          <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
            {popular.length > 0 ? "ALL TEMPLATES" : "TEMPLATES"}
          </p>
          <motion.div
            variants={variants.staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {others.map((t) => (
              <motion.div key={t.id} variants={variants.staggerItem}>
                <TemplateCard
                  template={t}
                  onUse={handleUseTemplate}
                  using={loadingTemplateId === t.id}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-3 py-12 text-center">
          <Search className="size-8 text-muted-foreground/40" strokeWidth={1.25} />
          <p className="text-[16px] font-semibold text-foreground">No templates found</p>
          <p className="text-[14px] text-muted-foreground">Try a different search term or category.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setCategory("all"); }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* CTA */}
      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.3 }}
        className="relative mt-16 rounded-[var(--radius-xl)] border border-border bg-surface/80 p-8 text-center shadow-sm backdrop-blur-xl dark:bg-surface/50 dark:ring-1 dark:ring-border/80"
      >
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
          CAN'T FIND WHAT YOU NEED?
        </p>
        <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.04em] text-foreground">
          Describe it and we'll build it
        </h3>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
          Every template started as a conversation. Start yours now.
        </p>
        <Button variant="accent" size="lg" className="mt-6" asChild>
          <Link href="/create">
            <Sparkles className="size-4" strokeWidth={1.75} />
            Start from prompt
          </Link>
        </Button>
      </motion.div>

      {/* Community templates — DB-backed, shows empty state if none exist */}
      <CommunityTemplatesSection />
    </div>
  );
}
