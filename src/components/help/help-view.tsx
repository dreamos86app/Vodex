"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Search,
  BookOpen,
  MessageSquare,
  Rocket,
  CreditCard,
  Shield,
  ChevronRight,
  Send,
  Loader2,
  Check,
  Play,
  AlertCircle,
  Smartphone,
  Sparkles,
  Plug,
  Globe,
  BarChart3,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { searchHelpArticles } from "@/lib/help-search";
import { HELP_CATEGORIES } from "@/lib/help/cms/categories";
import { getArticlesByCategorySlug } from "@/lib/help/cms/registry";
import { helpCategoryPath, helpArticlePath } from "@/lib/help/cms/paths";
import { getRecentHelpViews } from "@/lib/help/recently-viewed";

const CATEGORY_ICONS: Record<string, typeof Rocket> = {
  "getting-started": Rocket,
  publishing: Globe,
  authentication: Shield,
  integrations: Plug,
  payments: CreditCard,
  "mobile-apps": Smartphone,
  analytics: BarChart3,
  domains: Link2,
  "ai-providers": Sparkles,
  troubleshooting: AlertCircle,
};

function ContactSupport() {
  const [form, setForm] = React.useState({ subject: "", body: "", category: "general" });
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to submit ticket");
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <Check className="mb-2 size-8 text-positive" />
        <p className="text-sm font-semibold">Ticket submitted</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Input
        placeholder="Subject"
        value={form.subject}
        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
        required
      />
      <textarea
        placeholder="Details"
        value={form.body}
        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        rows={4}
        required
        className="w-full rounded-md bg-surface px-3 py-2 text-sm ring-1 ring-border"
      />
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Submit
      </Button>
    </form>
  );
}

export function HelpView() {
  const [search, setSearch] = React.useState("");
  const [recent, setRecent] = React.useState<ReturnType<typeof getRecentHelpViews>>([]);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    setRecent(getRecentHelpViews());
  }, []);

  const searchHits = React.useMemo(
    () => (search.trim() ? searchHelpArticles(search, 12) : []),
    [search],
  );

  return (
    <div className="help-page-shell relative -mx-[var(--page-padding-x)] min-h-full px-[var(--page-padding-x)] pb-14 pt-1">
      <div className="relative z-[1] mx-auto max-w-4xl">
        <motion.div
          variants={variants.staggerContainer}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          className="space-y-8"
        >
          <motion.header variants={variants.fadeUp} className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">
              Help Center
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Integration Academy, payments, auth, mobile — step-by-step guides.
            </p>
            <div className="relative mx-auto mt-5 max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guides, providers, errors…"
                className="h-11 w-full rounded-xl bg-background/95 pl-9 pr-3 text-sm ring-1 ring-border outline-none focus:ring-accent/40"
              />
            </div>
          </motion.header>

          {search.trim() ? (
            <motion.div variants={variants.fadeUp} className="rounded-xl bg-background p-4 ring-1 ring-border">
              <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Results</p>
              {searchHits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No articles found.</p>
              ) : (
                <ul>
                  {searchHits.map((hit) => (
                    <li key={hit.href}>
                      <Link
                        href={hit.href}
                        className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/40"
                      >
                        <ChevronRight className="mt-0.5 size-3 text-accent" />
                        <span>
                          <span className="font-medium">{hit.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {hit.category} — {hit.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          ) : (
            <>
              {recent.length > 0 ? (
                <motion.div variants={variants.fadeUp} className="rounded-xl bg-background p-4 ring-1 ring-border">
                  <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                    Recently viewed
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <Link
                        key={r.href}
                        href={r.href}
                        className="rounded-full bg-muted/50 px-3 py-1 text-[12px] hover:bg-muted"
                      >
                        {r.title}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              ) : null}

              <motion.div variants={variants.fadeUp}>
                <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                  Browse by category
                </p>
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {HELP_CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.slug] ?? BookOpen;
                    const articles = getArticlesByCategorySlug(cat.slug);
                    return (
                      <article
                        key={cat.slug}
                        className="rounded-xl bg-background p-4 ring-1 ring-border transition hover:ring-accent/30"
                      >
                        <Link href={helpCategoryPath(cat.slug)} className="flex items-center gap-2">
                          <Icon className="size-4 text-accent" />
                          <h3 className="text-[13px] font-semibold text-foreground">{cat.title}</h3>
                        </Link>
                        <p className="mt-1 text-[11px] text-muted-foreground">{cat.description}</p>
                        <ul className="mt-3 space-y-0.5">
                          {articles.slice(0, 4).map((a) => (
                            <li key={helpArticlePath(a)}>
                              <Link
                                href={helpArticlePath(a)}
                                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
                              >
                                <ChevronRight className="size-3 opacity-50" />
                                {a.title}
                              </Link>
                            </li>
                          ))}
                          {articles.length > 4 ? (
                            <li>
                              <Link
                                href={helpCategoryPath(cat.slug)}
                                className="text-[11px] text-accent hover:underline"
                              >
                                View all {articles.length} guides →
                              </Link>
                            </li>
                          ) : null}
                        </ul>
                      </article>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}

          <motion.div variants={variants.fadeUp} className="rounded-xl bg-background p-4 ring-1 ring-border">
            <div className="flex items-center gap-2">
              <Play className="size-4 text-muted-foreground" />
              <p className="text-[13px] font-semibold">Video tutorials</p>
              <span className="ml-auto text-[10px] text-muted-foreground">Coming soon</span>
            </div>
          </motion.div>

          <motion.div variants={variants.fadeUp} className="rounded-xl bg-background ring-1 ring-border">
            <div className="border-b border-border px-4 py-3">
              <MessageSquare className="inline size-4 text-muted-foreground" /> Contact support
            </div>
            <div className="p-4">
              <ContactSupport />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
