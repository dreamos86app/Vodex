"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Search,
  BookOpen,
  MessageSquare,
  Zap,
  Code2,
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
  KeyRound,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { getDocsByCategory, type DocArticle } from "@/lib/docs";
import { searchHelpArticles } from "@/lib/help-search";

const CATEGORY_ORDER = [
  "Getting Started",
  "AI Modes",
  "Integrations",
  "Billing",
  "Deployment",
  "Configuration",
  "Mobile Publishing",
  "ZIP Imports",
  "Policies",
  "FAQ",
] as const;

const CATEGORY_ICONS: Record<string, typeof Rocket> = {
  "Getting Started": Rocket,
  "AI Modes": Zap,
  Integrations: Code2,
  Billing: CreditCard,
  Deployment: Shield,
  Configuration: BookOpen,
  "Mobile Publishing": Smartphone,
  "ZIP Imports": BookOpen,
  Policies: Shield,
  FAQ: MessageSquare,
};

const CATEGORY_LABELS: Record<string, string> = {
  Policies: "Policies & legal",
};

/** External legal pages — listed under Policies like other doc links */
const POLICY_EXTERNAL_LINKS = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund Policy", href: "/refunds" },
] as const;

const POPULAR_GUIDES = [
  { label: "Getting started", href: "/help/docs/getting-started", icon: Rocket },
  { label: "How credits work", href: "/help/docs/how-credits-work", icon: CreditCard },
  { label: "OAuth setup", href: "/help/docs/oauth-setup", icon: KeyRound },
  { label: "Policies & legal", href: "/help/docs/policies", icon: Scale },
  { label: "Mobile & Capacitor", href: "/help/docs/capacitor-export", icon: Rocket },
] as const;

function HelpWelcomeStrip() {
  return (
    <section className="help-welcome-strip relative overflow-hidden rounded-2xl px-5 py-5 sm:px-6 sm:py-6">
      <div
        className="pointer-events-none absolute -right-12 -top-10 size-40 rounded-full bg-accent/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-8 left-1/4 size-28 rounded-full bg-sky-300/15 blur-2xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md text-left">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/15">
            <Sparkles className="size-3" strokeWidth={2} />
            Popular guides
          </div>
          <p className="text-[15px] font-medium leading-snug text-foreground">
            New here? Start with a guide, or browse every topic below.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Docs for building apps, credits, integrations, and publishing — all in one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:max-w-sm sm:justify-end">
          {POPULAR_GUIDES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-[12px] font-medium text-foreground ring-1 ring-border/80 shadow-sm transition hover:bg-background hover:ring-accent/30"
              >
                <Icon className="size-3.5 text-accent" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function orderedDocCategories(byCategory: Record<string, DocArticle[]>) {
  return CATEGORY_ORDER.filter((cat) => byCategory[cat]?.length).map(
    (cat) => [cat, byCategory[cat]!] as const,
  );
}

type TicketForm = {
  subject: string;
  body: string;
  category: string;
};

function ContactSupport() {
  const [form, setForm] = React.useState<TicketForm>({ subject: "", body: "", category: "general" });
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
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-positive/10 ring-1 ring-positive/20">
          <Check className="size-5 text-positive" strokeWidth={2} />
        </div>
        <p className="text-sm font-semibold text-foreground">Ticket submitted</p>
        <p className="mt-1 text-xs text-muted-foreground">We&apos;ll get back to you within 24 hours.</p>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setForm({ subject: "", body: "", category: "general" });
          }}
          className="mt-3 text-xs text-accent hover:underline underline-offset-2"
        >
          Submit another ticket
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Category</label>
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="h-9 w-full rounded-[var(--radius-md)] bg-surface px-3 text-sm text-foreground ring-1 ring-border outline-none focus:ring-accent/40"
        >
          <option value="general">General question</option>
          <option value="billing">Billing</option>
          <option value="technical">Technical issue</option>
          <option value="feature">Feature request</option>
          <option value="abuse">Report abuse</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Subject</label>
        <Input
          placeholder="Brief description of your issue"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Details</label>
        <textarea
          placeholder="Describe your issue in detail…"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          rows={4}
          required
          className="w-full resize-none rounded-[var(--radius-md)] bg-surface px-3 py-2 text-sm text-foreground ring-1 ring-border outline-none focus:ring-accent/40"
        />
      </div>

      <Button
        variant="accent"
        size="sm"
        type="submit"
        disabled={loading || !form.subject || !form.body}
        className="gap-1.5"
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" strokeWidth={2} />}
        Submit ticket
      </Button>
    </form>
  );
}

function DocRow({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const className =
    "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground transition hover:bg-muted/40 hover:text-foreground";
  const content = (
    <>
      <ChevronRight className="size-3 shrink-0 opacity-50" strokeWidth={2} />
      {label}
    </>
  );
  if (external) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function CategoryCard({
  cat,
  docs,
  externalLinks = [],
}: {
  cat: string;
  docs: DocArticle[];
  externalLinks?: readonly { label: string; href: string }[];
}) {
  const Icon = CATEGORY_ICONS[cat] ?? BookOpen;
  const isBilling = cat === "Billing";

  return (
    <article
      className={cn(
        "rounded-[var(--radius-lg)] bg-background p-4 ring-1 ring-border",
        isBilling && "sm:col-span-2",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-accent" strokeWidth={1.75} />
        <h3 className="text-[13px] font-semibold text-foreground">{CATEGORY_LABELS[cat] ?? cat}</h3>
      </div>
      <ul className={cn("space-y-0", isBilling && "sm:columns-2 sm:gap-x-6 [&>li]:break-inside-avoid")}>
        {docs.map((doc) => (
          <li key={doc.slug}>
            <DocRow href={`/help/docs/${doc.slug}`} label={doc.title} />
          </li>
        ))}
        {externalLinks.map((link) => (
          <li key={link.href}>
            <DocRow href={link.href} label={link.label} external />
          </li>
        ))}
      </ul>
    </article>
  );
}

export function HelpView() {
  const [search, setSearch] = React.useState("");
  const reduceMotion = useReducedMotion();
  const byCategory = React.useMemo(() => getDocsByCategory(), []);
  const categories = React.useMemo(() => orderedDocCategories(byCategory), [byCategory]);
  const searchHits = React.useMemo(
    () => (search.trim() ? searchHelpArticles(search, 10) : []),
    [search],
  );

  const showSearchResults = search.trim().length > 0;

  return (
    <div className="help-page-shell relative -mx-[var(--page-padding-x)] min-h-full px-[var(--page-padding-x)] pb-14 pt-1">
      <div className="help-page-glow" aria-hidden />

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
            <p className="mt-2 text-sm text-muted-foreground">Guides, docs, and support.</p>
            <div className="relative mx-auto mt-5 max-w-md">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs, errors, keywords…"
              className="h-11 w-full rounded-xl bg-background/95 pl-9 pr-3 text-sm text-foreground shadow-sm ring-1 ring-border/90 outline-none backdrop-blur-sm focus:ring-accent/40"
            />
          </div>
        </motion.header>

        {showSearchResults ? (
          <motion.div variants={variants.fadeUp} className="rounded-xl bg-background p-4 ring-1 ring-border">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Results
            </p>
            {searchHits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No articles found.</p>
            ) : (
              <ul>
                {searchHits.map((hit) => (
                  <li key={hit.slug}>
                    <Link
                      href={`/help/docs/${hit.slug}`}
                      className="flex items-start gap-2 rounded-md px-1.5 py-1.5 text-sm transition hover:bg-muted/40"
                    >
                      <ChevronRight className="mt-0.5 size-3 shrink-0 text-accent" strokeWidth={2} />
                      <span>
                        <span className="font-medium text-foreground">{hit.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{hit.description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : (
          <>
            <motion.div variants={variants.fadeUp}>
              <HelpWelcomeStrip />
            </motion.div>

            <motion.div variants={variants.fadeUp}>
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                All documentation
              </p>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map(([cat, docs]) => (
                  <CategoryCard
                    key={cat}
                    cat={cat}
                    docs={docs}
                    externalLinks={cat === "Policies" ? POLICY_EXTERNAL_LINKS : undefined}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}

        <motion.div variants={variants.fadeUp} className="rounded-xl bg-background p-4 ring-1 ring-border">
          <div className="flex items-center gap-2">
            <Play className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <p className="text-[13px] font-semibold text-foreground">Video tutorials</p>
            <span className="ml-auto text-[10px] font-medium text-muted-foreground">Coming soon</span>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Until then, see{" "}
            <Link href="/help/docs/help-faq" className="text-accent hover:underline">
              FAQ
            </Link>{" "}
            or{" "}
            <Link href="/help/docs/getting-started" className="text-accent hover:underline">
              Getting Started
            </Link>
            .
          </p>
        </motion.div>

        <motion.div variants={variants.fadeUp} className="rounded-xl bg-background ring-1 ring-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageSquare className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <div>
              <p className="text-[13px] font-semibold text-foreground">Contact support</p>
              <p className="text-[11px] text-muted-foreground">
                <a href="mailto:support@vodex.dev" className="text-accent hover:underline">
                  support@vodex.dev
                </a>
                {" · "}
                ~24h response
              </p>
            </div>
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
