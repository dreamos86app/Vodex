"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Plus, Sparkles, Flame, TrendingUp, Rocket,
  Users, X, Loader2, ChevronRight, Tag, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Discussion } from "@/lib/supabase/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscussionWithAuthor = Discussion & {
  author_name?: string;
  author_avatar?: string;
  liked?: boolean;
};

const CATEGORIES = ["General", "Tips", "Guide", "Feedback", "Showcase", "Question", "Announcement"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-muted/60 text-muted-foreground",
  Tips: "bg-accent/10 text-accent",
  Guide: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Feedback: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Showcase: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Question: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  Announcement: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

// ─── Create discussion modal ──────────────────────────────────────────────────

function CreateDiscussionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (d: Discussion) => void;
}) {
  const supabase = createClient();
  const { user, profile } = useAuthStore();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<Category>("General");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || !body.trim()) return;
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("discussions")
      .insert({ user_id: user.id, title: title.trim(), body: body.trim(), category })
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? "Failed to create discussion.");
      setLoading(false);
    } else {
      onCreated(data as Discussion);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] bg-background shadow-2xl ring-1 ring-border"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-[14px] font-semibold text-foreground">Start a discussion</p>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground transition">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive ring-1 ring-destructive/20">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11.5px] font-medium transition ring-1",
                    category === cat
                      ? "bg-foreground text-background ring-transparent"
                      : "ring-border text-muted-foreground hover:text-foreground hover:bg-surface",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={200}
              required
              className="h-10 w-full rounded-[var(--radius-md)] bg-surface px-3 text-[13px] text-foreground ring-1 ring-border outline-none focus:ring-accent/50 transition placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts, questions, or ideas…"
              rows={5}
              maxLength={10000}
              required
              className="w-full rounded-[var(--radius-md)] bg-surface px-3 py-2.5 text-[13px] text-foreground ring-1 ring-border outline-none focus:ring-accent/50 transition resize-none placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button variant="accent" size="sm" type="submit" disabled={loading || !title.trim() || !body.trim()} className="gap-1.5">
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" strokeWidth={1.75} />}
              Post
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Discussion card ──────────────────────────────────────────────────────────

function DiscussionCard({
  disc,
  onLike,
}: {
  disc: DiscussionWithAuthor;
  onLike: (id: string) => void;
}) {
  const authorName = disc.author_name ?? "Community member";
  const timeAgo = React.useMemo(() => {
    const diff = Date.now() - new Date(disc.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [disc.created_at]);

  return (
    <div className="flex items-start gap-4 px-5 py-4 transition hover:bg-muted/20 cursor-pointer">
      <Avatar name={authorName} src={disc.author_avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-[13px] font-medium text-foreground leading-snug">{disc.title}</p>
          {disc.is_pinned && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent shrink-0">Pinned</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_COLORS[disc.category] ?? CATEGORY_COLORS.General)}>
            {disc.category}
          </span>
          <span className="text-[11.5px] text-muted-foreground">{authorName}</span>
          <span className="text-[11.5px] text-muted-foreground/40">·</span>
          <span className="text-[11.5px] text-muted-foreground">{timeAgo}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onLike(disc.id); }}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-surface",
            disc.liked && "text-red-500",
          )}
        >
          <Heart className={cn("size-3.5", disc.liked && "fill-current")} strokeWidth={disc.liked ? 0 : 1.55} />
          {disc.like_count}
        </button>
        <span className="flex items-center gap-1">
          <MessageCircle className="size-3.5" strokeWidth={1.55} />
          {disc.reply_count}
        </span>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const INSPIRATION_CARDS = [
  {
    icon: Sparkles,
    color: "text-accent bg-accent/10",
    title: "Share what you built",
    desc: "Finished a project? Post a showcase. The community loves seeing real apps.",
  },
  {
    icon: TrendingUp,
    color: "text-emerald-500 bg-emerald-500/10",
    title: "Post a tip or guide",
    desc: "Share something that helped you. Good knowledge compounds for everyone.",
  },
  {
    icon: MessageCircle,
    color: "text-violet-500 bg-violet-500/10",
    title: "Ask a question",
    desc: "Stuck on something? Ask the community. We all learn together.",
  },
  {
    icon: Rocket,
    color: "text-orange-500 bg-orange-500/10",
    title: "Get feedback",
    desc: "Describe your idea. Early feedback from real builders is invaluable.",
  },
];

function EmptyDiscussions({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface px-6 py-12 text-center ring-1 ring-border">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet-500/20 ring-1 ring-accent/25"
        >
          <Users className="size-8 text-accent" strokeWidth={1.5} />
        </motion.div>
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          Be the first voice here
        </h2>
        <p className="mt-2 max-w-md text-[13px] text-muted-foreground leading-relaxed">
          DreamOS86 is early and this community is yours to shape. Ask questions, share builds, leave feedback, post tips — everything counts.
        </p>
        <Button variant="accent" size="sm" className="mt-6 gap-1.5" onClick={onStart}>
          <Plus className="size-3.5" strokeWidth={2} />
          Start the first discussion
        </Button>
      </div>

      {/* What to post */}
      <div>
        <p className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
          What can I post?
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INSPIRATION_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.title}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                onClick={onStart}
                className="group flex items-start gap-3 rounded-xl bg-surface p-4 text-left ring-1 ring-border transition hover:ring-accent/30 hover:shadow-sm"
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.color}`}>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold text-foreground">{card.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{card.desc}</p>
                </div>
                <ChevronRight className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground/30 transition group-hover:text-muted-foreground/70" strokeWidth={1.75} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const TABS = ["Discussions", "Groups", "Trending", "Community", "Builders"] as const;
type Tab = (typeof TABS)[number];

export function CommunityView() {
  const supabase = createClient();
  const { user } = useAuthStore();
  const [tab, setTab] = React.useState<Tab>("Discussions");
  const [discussions, setDiscussions] = React.useState<DiscussionWithAuthor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [likedIds, setLikedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (tab !== "Discussions") { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      supabase
        .from("discussions")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
      user
        ? supabase.from("discussion_likes").select("discussion_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]).then(([{ data: discs, error: discErr }, { data: likes }]) => {
      if (discErr) {
        // Table doesn't exist yet — show empty state instead of crashing
        setDiscussions([]);
        setLoading(false);
        return;
      }
      const liked = new Set((likes ?? []).map((l: { discussion_id: string }) => l.discussion_id));
      setLikedIds(liked);
      setDiscussions(
        (discs ?? []).map((d) => ({
          ...d,
          liked: liked.has(d.id),
        })) as DiscussionWithAuthor[],
      );
      setLoading(false);
    });
  }, [tab, user?.id]);

  async function handleLike(discussionId: string) {
    if (!user) return;
    const isLiked = likedIds.has(discussionId);

    setDiscussions((prev) =>
      prev.map((d) =>
        d.id === discussionId
          ? { ...d, liked: !isLiked, like_count: d.like_count + (isLiked ? -1 : 1) }
          : d,
      ),
    );
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(discussionId);
      else next.add(discussionId);
      return next;
    });

    if (isLiked) {
      await supabase.from("discussion_likes").delete().eq("user_id", user.id).eq("discussion_id", discussionId);
      await supabase.from("discussions").update({ like_count: discussions.find((d) => d.id === discussionId)!.like_count - 1 }).eq("id", discussionId);
    } else {
      await supabase.from("discussion_likes").insert({ user_id: user.id, discussion_id: discussionId });
      await supabase.from("discussions").update({ like_count: discussions.find((d) => d.id === discussionId)!.like_count + 1 }).eq("id", discussionId);
    }
  }

  function handleCreated(d: Discussion) {
    const profileName = useAuthStore.getState().profile?.full_name ?? user?.email?.split("@")[0] ?? "You";
    setDiscussions((prev) => [{ ...d, author_name: profileName, liked: false }, ...prev]);
    setTab("Discussions");
  }

  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_8%,transparent),transparent_68%)] blur-3xl" />

      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        className="relative flex items-start justify-between gap-4"
      >
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">COMMUNITY</p>
          <h1 className="mt-3 text-[clamp(1.75rem,3.5vw,2.4rem)] font-semibold tracking-[-0.055em] text-foreground">
            Community
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Built by builders, for builders.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="accent" size="md" onClick={() => setShowCreate(true)} disabled={!user}>
            <Plus className="size-4" strokeWidth={1.75} />
            Start discussion
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.05 }}
        className="relative mt-6 flex gap-1 overflow-x-auto rounded-[var(--radius-lg)] bg-surface p-1 ring-1 ring-border scrollbar-none"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-[calc(var(--radius-lg)-2px)] px-4 py-1.5 text-[13px] font-medium transition",
              tab === t
                ? "bg-foreground text-background shadow-[var(--shadow-xs)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </motion.div>

      {/* Trending tab */}
      {tab === "Trending" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-12 text-center ring-1 ring-border">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
              <Flame className="size-7 text-accent" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Trending picks up as posts roll in</p>
            <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
              The most liked, shared, and discussed content rises here automatically. Start the conversation.
            </p>
            <Button variant="accent" size="sm" className="mt-6 gap-1.5" onClick={() => setTab("Discussions")}>
              <Sparkles className="size-3.5" strokeWidth={1.75} />
              Start a discussion
            </Button>
          </div>
        </motion.div>
      )}

      {/* Community apps tab */}
      {tab === "Community" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-12 text-center ring-1 ring-border px-6">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
              <Rocket className="size-7 text-accent" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Ship your first app to appear here</p>
            <p className="mt-2 max-w-md text-[13px] text-muted-foreground leading-relaxed">
              Apps built on DreamOS86 that are marked public will surface in this feed. Create something incredible and let the community discover it.
            </p>
            <Button
              variant="accent"
              size="sm"
              className="mt-6 gap-1.5"
              onClick={() => window.open("/", "_self")}
            >
              <Sparkles className="size-3.5" strokeWidth={1.75} />
              Create your first app
            </Button>
          </div>
        </motion.div>
      )}

      {/* Groups tab */}
      {tab === "Groups" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6 space-y-4">
          {/* Featured groups */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "AI SaaS Builders", desc: "Teams building AI-native B2B products with DreamOS86.", emoji: "🚀", members: 284, tag: "SaaS", gradient: "from-blue-500/20 to-violet-500/20", featured: true },
              { name: "Frontend Artisans", desc: "Obsessing over pixel-perfect, performant UI and animation.", emoji: "🎨", members: 197, tag: "Design", gradient: "from-pink-500/20 to-rose-500/20", featured: false },
              { name: "Indie Hackers", desc: "Solo founders building and shipping fast with AI generation.", emoji: "⚡", members: 452, tag: "Indie", gradient: "from-amber-500/20 to-orange-500/20", featured: false },
              { name: "Backend Systems", desc: "Infrastructure, APIs, databases, and distributed architecture.", emoji: "🗄️", members: 163, tag: "Backend", gradient: "from-emerald-500/20 to-cyan-500/20", featured: false },
              { name: "Mobile Builders", desc: "React Native and mobile-first apps built with AI orchestration.", emoji: "📱", members: 118, tag: "Mobile", gradient: "from-violet-500/20 to-purple-500/20", featured: false },
              { name: "Open Source Lab", desc: "Building in public, open source, and community-driven projects.", emoji: "🔬", members: 95, tag: "Open Source", gradient: "from-teal-500/20 to-green-500/20", featured: false },
            ].map((g) => (
              <motion.div
                key={g.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "group cursor-pointer overflow-hidden rounded-[var(--radius-xl)] bg-surface ring-1 transition hover:ring-accent/30 hover:shadow-md",
                  g.featured ? "ring-accent/30 sm:col-span-2 lg:col-span-1" : "ring-border",
                )}
              >
                {/* Banner */}
                <div className={cn("h-16 w-full bg-gradient-to-br", g.gradient)} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{g.emoji}</span>
                      <div>
                        <p className="text-[13.5px] font-semibold text-foreground">{g.name}</p>
                        <p className="text-[11px] text-muted-foreground">{g.members.toLocaleString()} members · {g.tag}</p>
                      </div>
                    </div>
                    {g.featured && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/20">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{g.desc}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" className="rounded-lg bg-accent/10 px-3 py-1.5 text-[11.5px] font-semibold text-accent ring-1 ring-accent/20 transition hover:bg-accent/20">
                      Join group
                    </button>
                    <button type="button" className="rounded-lg bg-surface-raised px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground ring-1 ring-border transition hover:text-foreground">
                      View
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Create group CTA */}
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-border p-6 text-center transition hover:border-accent/30">
            <p className="text-[13.5px] font-semibold text-foreground">Start a builder collective</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Create a group around a niche, stack, or product category.</p>
            <button type="button" className="mt-4 rounded-xl bg-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-accent/90">
              Create a group
            </button>
          </div>
        </motion.div>
      )}

      {/* Discussions tab */}
      {tab === "Discussions" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : discussions.length === 0 ? (
            <EmptyDiscussions onStart={() => setShowCreate(true)} />
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-xl)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-border divide-y divide-border/60">
              {discussions.map((disc) => (
                <DiscussionCard key={disc.id} disc={disc} onLike={handleLike} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Builders tab */}
      {tab === "Builders" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-12 text-center ring-1 ring-border px-6">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
              <Users className="size-7 text-accent" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Earn your spot on the leaderboard</p>
            <p className="mt-2 max-w-md text-[13px] text-muted-foreground leading-relaxed">
              The builder leaderboard celebrates creators who ship the most, help the most, and inspire the most. Start building — every project, post, and contribution counts.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="accent" size="sm" className="gap-1.5" onClick={() => window.open("/", "_self")}>
                <Sparkles className="size-3.5" strokeWidth={1.75} />
                Build something
              </Button>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                <MessageCircle className="size-3.5" strokeWidth={1.75} />
                Post a discussion
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateDiscussionModal
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
