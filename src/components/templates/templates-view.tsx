"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  ArrowUpRight,
  Sparkles,
  Loader2,
  ThumbsUp,
  Users,
  Package,
} from "lucide-react";
import type { Template, TemplateCategory } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { variants, whileHover, whileTap, transition } from "@/lib/motion";
import { toast } from "@/lib/toast";
import {
  OFFICIAL_TEMPLATES,
  getOfficialTemplatePreviewUrl,
} from "@/lib/templates/official-templates";
import { getTemplateSourceFiles } from "@/lib/templates/template-source-files";

const TEMPLATE_LOADING_MSG = "Creating your template workspace…";

type TabId = "official" | "community";

const complexityLabel = {
  simple: { label: "Simple", color: "text-positive bg-positive-muted" },
  medium: { label: "Medium", color: "text-accent bg-accent-muted" },
  advanced: { label: "Advanced", color: "text-warning bg-warning-muted" },
} as const;

async function activateTemplate(templateId: string): Promise<void> {
  const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}/use`, {
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

function OfficialTemplateCard({
  template,
  onUse,
  using,
}: {
  template: Template;
  onUse: (t: Template) => void;
  using?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  const cx = complexityLabel[template.complexity];
  const preview = getOfficialTemplatePreviewUrl(template.id);

  return (
    <motion.article
      whileHover={whileHover.lift}
      whileTap={whileTap.press}
      transition={transition.card}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="h-full"
      data-testid="official-template-card"
    >
      <div className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-glass shadow-[var(--shadow-glass)] ring-1 ring-border transition hover:shadow-[var(--shadow-glass-hover)] hover:ring-accent/30">
        <div className="relative min-h-[160px] overflow-hidden bg-muted/30">
          <Image
            src={preview}
            alt={`${template.name} preview`}
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, 33vw"
            data-testid="template-preview-image"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: hovered ? 1 : 0 }}
            className="absolute inset-0 flex items-center justify-center bg-foreground/10 backdrop-blur-[2px]"
          >
            <button
              type="button"
              disabled={using}
              onClick={() => onUse(template)}
              className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background shadow-lg disabled:opacity-60"
              data-testid="use-template-button"
            >
              {using ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {using ? "Creating…" : "Use template"}
            </button>
          </motion.div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              {template.name}
            </h3>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", cx.color)}>
              {cx.label}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{template.description}</p>
          <div className="flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/50"
              >
                {tag}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled={using}
            onClick={() => onUse(template)}
            className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px] font-semibold text-accent"
          >
            Use template <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

interface CommunityItem {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  previewImageUrl: string | null;
  useCount: number;
  likeCount: number;
  creatorName: string;
  likedByMe: boolean;
}

function CommunityTemplateCard({
  item,
  onUse,
  onToggleLike,
  using,
  liking,
}: {
  item: CommunityItem;
  onUse: (id: string) => void;
  onToggleLike: (id: string) => void;
  using?: boolean;
  liking?: boolean;
}) {
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-surface ring-1 ring-border transition hover:ring-accent/30 hover:shadow-md"
      data-testid="community-template-card"
    >
      <div className="relative min-h-[140px] bg-muted/40">
        {item.previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewImageUrl}
            alt=""
            className="h-full min-h-[140px] w-full object-cover"
            data-testid="template-preview-image"
          />
        ) : (
          <div className="flex min-h-[140px] items-center justify-center bg-gradient-to-br from-sky-500/10 to-violet-500/10">
            <Package className="size-8 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-foreground">{item.name}</p>
            <p className="text-[11px] text-muted-foreground">by {item.creatorName}</p>
          </div>
          <button
            type="button"
            disabled={liking}
            onClick={() => onToggleLike(item.id)}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold transition hover:bg-muted/60"
            data-testid="template-like-button"
            aria-pressed={item.likedByMe}
          >
            <ThumbsUp
              className={cn(
                "size-4",
                item.likedByMe
                  ? "fill-sky-500 text-sky-500"
                  : "fill-none text-foreground stroke-[1.75]",
              )}
              strokeWidth={item.likedByMe ? 0 : 1.75}
            />
            <span className={item.likedByMe ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground"}>
              {item.likeCount}
            </span>
          </button>
        </div>
        <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
          {item.description}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {item.category}
          </span>
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground">{item.useCount} uses</span>
        </div>
        <button
          type="button"
          disabled={using}
          onClick={() => onUse(item.id)}
          className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold text-accent disabled:opacity-50"
          data-testid="use-template-button"
        >
          {using ? "Creating…" : "Use template"}
          {!using && <ArrowUpRight className="size-3.5" />}
        </button>
      </div>
    </article>
  );
}

export function TemplatesView() {
  const searchParams = useSearchParams();
  const initialTab: TabId = searchParams.get("tab") === "community" ? "community" : "official";

  const [tab, setTab] = React.useState<TabId>(initialTab);
  const [search, setSearch] = React.useState("");
  const [loadingTemplateId, setLoadingTemplateId] = React.useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = React.useState<string | null>(null);
  const [community, setCommunity] = React.useState<CommunityItem[]>([]);
  const [communityLoading, setCommunityLoading] = React.useState(true);
  const [likingId, setLikingId] = React.useState<string | null>(null);

  const officialTemplates = React.useMemo(
    () => OFFICIAL_TEMPLATES.filter((t) => getTemplateSourceFiles(t.id).length > 0),
    [],
  );

  const loadCommunity = React.useCallback(async () => {
    setCommunityLoading(true);
    try {
      const res = await fetch("/api/templates/community");
      const data = (await res.json()) as { items?: CommunityItem[] };
      setCommunity(data.items ?? []);
    } catch {
      setCommunity([]);
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (tab === "community") void loadCommunity();
  }, [tab, loadCommunity]);

  const handleUseOfficial = React.useCallback(async (template: Template) => {
    setLoadingTemplateId(template.id);
    setLoadingMessage(TEMPLATE_LOADING_MSG);
    try {
      await activateTemplate(template.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use template");
      setLoadingTemplateId(null);
      setLoadingMessage(null);
    }
  }, []);

  const handleUseCommunity = React.useCallback(async (id: string) => {
    setLoadingTemplateId(id);
    setLoadingMessage(TEMPLATE_LOADING_MSG);
    try {
      await activateTemplate(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use template");
      setLoadingTemplateId(null);
      setLoadingMessage(null);
    }
  }, []);

  const handleToggleLike = React.useCallback(
    async (id: string) => {
      setLikingId(id);
      try {
        const res = await fetch(`/api/templates/${encodeURIComponent(id)}/like`, {
          method: "POST",
        });
        const data = (await res.json()) as { liked?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Like failed");
        setCommunity((prev) =>
          prev.map((t) => {
            if (t.id !== id) return t;
            const liked = Boolean(data.liked);
            return {
              ...t,
              likedByMe: liked,
              likeCount: Math.max(0, t.likeCount + (liked ? 1 : -1)),
            };
          }),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update like");
      } finally {
        setLikingId(null);
      }
    },
    [],
  );

  const filteredOfficial = officialTemplates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const filteredCommunity = community.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative mx-auto max-w-6xl" data-testid="templates-view">
      {loadingMessage ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          data-testid="template-workspace-loading"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-8 py-6 shadow-xl ring-1 ring-border">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="text-[14px] font-semibold text-foreground">{loadingMessage}</p>
          </div>
        </div>
      ) : null}

      <motion.div variants={variants.fadeUp} initial="hidden" animate="show">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">TEMPLATES</p>
        <h1 className="mt-3 text-balance text-[clamp(1.85rem,3.5vw,2.6rem)] font-semibold tracking-[-0.055em] text-foreground">
          Start from a real codebase
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Official starters duplicate full project files into your workspace. Community Templates are
          published by Pro+ builders.
        </p>
      </motion.div>

      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.05 }}
        className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div
          className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border"
          data-testid="templates-tab-switcher"
        >
          {(
            [
              { id: "official" as const, label: "Official" },
              { id: "community" as const, label: "Community Templates" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12px] font-semibold transition",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-[var(--radius-md)] bg-surface pl-9 pr-4 text-[13px] ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </motion.div>

      {tab === "official" ? (
        <motion.div
          variants={variants.fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.1 }}
          className="mt-10"
          data-testid="official-templates-grid"
        >
          {filteredOfficial.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No official templates match your search.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOfficial.map((t) => (
                <OfficialTemplateCard
                  key={t.id}
                  template={t}
                  onUse={handleUseOfficial}
                  using={loadingTemplateId === t.id}
                />
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={variants.fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.1 }}
          className="mt-10"
          data-testid="community-templates-grid"
        >
          {communityLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-accent" />
            </div>
          ) : filteredCommunity.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface/50 px-8 py-14 text-center ring-1 ring-border">
              <Users className="size-8 text-accent" />
              <p className="text-[15px] font-semibold text-foreground">No Community Templates yet</p>
              <p className="max-w-sm text-[13px] text-muted-foreground">
                Pro+ users can publish an app as a template from the project dashboard.
              </p>
              <Button variant="accent" size="sm" asChild>
                <Link href="/apps">Open your apps</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCommunity.map((item) => (
                <CommunityTemplateCard
                  key={item.id}
                  item={item}
                  onUse={handleUseCommunity}
                  onToggleLike={handleToggleLike}
                  using={loadingTemplateId === item.id}
                  liking={likingId === item.id}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.2 }}
        className="mt-16 rounded-[var(--radius-xl)] border border-border bg-surface/80 p-8 text-center"
      >
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
          NEED SOMETHING CUSTOM?
        </p>
        <h3 className="mt-3 text-[20px] font-semibold text-foreground">Describe it in Create</h3>
        <Button variant="accent" size="lg" className="mt-6" asChild>
          <Link href="/create">
            <Sparkles className="size-4" />
            Start from prompt
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
