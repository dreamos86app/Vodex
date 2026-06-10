"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Plus, Sparkles, Flame, TrendingUp, Rocket,
  Users, X, Loader2, ChevronRight, Send, Upload, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Discussion } from "@/lib/supabase/types";
import { DiscussionDetailDrawer } from "@/components/community/discussion-detail-drawer";
import { CommunityHeartButton } from "@/components/community/community-heart-button";
import { GroupCategoryBadges, parseGroupCategories } from "@/components/community/group-category-badges";
import { GroupCategoryPicker } from "@/components/community/group-category-picker";
import { ConfirmDialog } from "@/components/community/confirm-dialog";
import { sortByTrending } from "@/lib/community/trending-score";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscussionWithAuthor = Discussion & {
  author_name?: string;
  author_username?: string | null;
  author_avatar?: string;
  liked?: boolean;
};

interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  categories?: string[] | null;
  icon_url: string | null;
  banner_color: string;
  is_public: boolean;
  is_featured: boolean;
  member_count: number;
  created_at: string;
  creator_id: string | null;
}

const CATEGORIES = ["General", "Tips", "Guide", "Feedback", "Showcase", "Question", "Announcement"] as const;
type Category = (typeof CATEGORIES)[number];

const BANNER_COLORS = [
  "#4f7cff", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9",
  "#64748b", "#1e293b",
];

function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label)), ms)),
  ]);
}

const COMMUNITY_FETCH_TIMEOUT_MS = 10_000;
const COMMUNITY_DISCUSSIONS_LIMIT = 30;

function DiscussionsInlineFallback({
  message,
  onRetry,
  onStartDiscussion,
}: {
  message: string;
  onRetry: () => void;
  onStartDiscussion?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-center">
      <p className="text-[13px] text-muted-foreground">{message}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={onRetry}>
          Retry
        </Button>
        {onStartDiscussion ? (
          <Button variant="accent" size="sm" type="button" onClick={onStartDiscussion}>
            Start discussion
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CommunityFetchFallback({
  title,
  description,
  onRetry,
  primaryHref = "/create",
  primaryLabel = "Start building",
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-12 text-center ring-1 ring-border px-6">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
        <Rocket className="size-7 text-accent" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-[13px] text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="accent" size="sm" className="gap-1.5" asChild>
          <Link href={primaryHref}>{primaryLabel}</Link>
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button variant="secondary" size="sm" type="button" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" type="button" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

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
  const { user } = useAuthStore();
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

    try {
      const { data, error: err } = await supabase
        .from("discussions")
        .insert({ user_id: user.id, title: title.trim(), body: body.trim(), category })
        .select()
        .single();

      if (err || !data) {
        setError(err?.message ?? "Failed to create discussion.");
      } else {
        onCreated(data as Discussion);
        onClose();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create discussion.");
    } finally {
      setLoading(false);
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

// ─── Create group modal ───────────────────────────────────────────────────────

function CreateGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: Group) => void;
}) {
  const { user } = useAuthStore();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categories, setCategories] = React.useState<string[]>(["General"]);
  const [bannerColor, setBannerColor] = React.useState("#4f7cff");
  const [iconFile, setIconFile] = React.useState<File | null>(null);
  const [iconPreview, setIconPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setIconPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function generateSlug(n: string) {
    return n.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60) + "-" + Date.now().toString(36);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    setError(null);

    let iconUrl: string | null = null;

    // Upload icon if provided
    if (iconFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", iconFile);
        const res = await fetch("/api/upload/group-icon", { method: "POST", body: formData });
        if (res.ok) {
          const { publicUrl } = await res.json();
          iconUrl = publicUrl;
        }
      } catch {
        // Non-fatal — proceed without icon
      }
      setUploading(false);
    }

    const res = await fetch("/api/community/groups", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        categories,
        bannerColor,
        iconUrl,
      }),
    });
    const payload = (await res.json()) as { group?: Group; error?: string };

    if (!res.ok || !payload.group) {
      setError(payload.error ?? "Failed to create group.");
      setLoading(false);
      return;
    }

    onCreated(payload.group);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[var(--radius-xl)] bg-background shadow-2xl ring-1 ring-border"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-5 py-4">
          <p className="text-[14px] font-semibold text-foreground">Create a group</p>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground transition">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Banner preview */}
        <div
          className="h-24 w-full transition-colors"
          style={{ background: bannerColor }}
        />

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="flex items-end gap-4 mt-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-2 ring-accent transition hover:opacity-90"
              style={{ background: iconPreview ? undefined : "rgba(79,124,255,0.12)" }}
            >
              {iconPreview ? (
                <img src={iconPreview} alt="Group icon" className="size-full object-cover" />
              ) : (
                <ImageIcon className="size-6 text-accent/70" strokeWidth={1.5} />
              )}
            </button>
            <div className="min-w-0 flex-1 pb-1">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive ring-1 ring-destructive/20">{error}</div>
          )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleIconChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-[12px] font-medium text-accent hover:underline underline-offset-2"
              >
                <Upload className="size-3.5" strokeWidth={1.75} />
                {iconPreview ? "Change group icon" : "Upload group icon (optional)"}
              </button>
            </div>
          </div>

          {/* Banner color picker */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Banner color</label>
            <div className="flex flex-wrap gap-2">
              {BANNER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBannerColor(c)}
                  className={cn(
                    "size-7 rounded-lg transition ring-2",
                    bannerColor === c ? "ring-foreground ring-offset-1" : "ring-transparent hover:ring-border",
                  )}
                  style={{ background: c }}
                  title={c}
                />
              ))}
              {/* Custom color input */}
              <div className="relative">
                <input
                  type="color"
                  value={bannerColor}
                  onChange={(e) => setBannerColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer size-7"
                  title="Custom color"
                />
                <div className="flex size-7 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground hover:border-accent transition cursor-pointer">
                  +
                </div>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Group name <span className="text-destructive">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI SaaS Builders"
              maxLength={60}
              required
              className="h-10 w-full rounded-[var(--radius-md)] bg-surface px-3 text-[13px] text-foreground ring-1 ring-border outline-none focus:ring-accent/50 transition placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Categories */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Categories</label>
            <GroupCategoryPicker value={categories} onChange={setCategories} />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Description <span className="text-muted-foreground/60">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={3}
              maxLength={500}
              className="w-full rounded-[var(--radius-md)] bg-surface px-3 py-2.5 text-[13px] text-foreground ring-1 ring-border outline-none focus:ring-accent/50 transition resize-none placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button variant="accent" size="sm" type="submit" disabled={loading || !name.trim()} className="gap-1.5">
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" strokeWidth={2} />}
              {uploading ? "Uploading icon…" : loading ? "Creating…" : "Create group"}
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
  onOpen,
}: {
  disc: DiscussionWithAuthor;
  onLike: (id: string) => void;
  onOpen: (disc: DiscussionWithAuthor) => void;
}) {
  const authorName = disc.author_name ?? "Community member";
  const timeAgo = React.useMemo(() => {
    // Relative timestamps are intentionally computed against wall-clock time.
    // eslint-disable-next-line react-hooks/purity -- time delta from created_at
    const diff = Date.now() - new Date(disc.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [disc.created_at]);

  const profileHref = disc.author_username ? `/builders/${disc.author_username}` : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(disc)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(disc);
      }}
      className="flex min-h-[148px] cursor-pointer flex-col rounded-[var(--radius-xl)] bg-surface p-4 ring-1 ring-border transition hover:ring-accent/30"
    >
      <div className="flex items-start gap-3">
        {profileHref ? (
          <Link href={profileHref} onClick={(e) => e.stopPropagation()} className="shrink-0">
            <Avatar name={authorName} src={disc.author_avatar} size="sm" />
          </Link>
        ) : (
          <Avatar name={authorName} src={disc.author_avatar} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[14px] font-semibold text-foreground leading-snug line-clamp-2">{disc.title}</p>
            {disc.is_pinned ? (
              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent shrink-0">Pinned</span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground">{disc.body}</p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_COLORS[disc.category] ?? CATEGORY_COLORS.General)}>
              {disc.category}
            </span>
            {profileHref ? (
              <Link href={profileHref} onClick={(e) => e.stopPropagation()} className="text-[11.5px] font-medium text-foreground hover:text-accent">
                {authorName}
              </Link>
            ) : (
              <span className="text-[11.5px] text-muted-foreground">{authorName}</span>
            )}
            <span className="text-[11.5px] text-muted-foreground/40">·</span>
            <span className="text-[11.5px] text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-end gap-3 pt-3 text-[11px] text-muted-foreground">
        <div onClick={(e) => e.stopPropagation()} role="presentation">
          <CommunityHeartButton liked={!!disc.liked} count={disc.like_count} onToggle={() => onLike(disc.id)} size="sm" />
        </div>
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
          No discussions yet
        </h2>
        <p className="mt-2 max-w-md text-[13px] text-muted-foreground leading-relaxed">
          Vodex is early and this community is yours to shape. Ask questions, share builds, leave feedback, post tips — everything counts.
        </p>
        <Button variant="accent" size="sm" className="mt-6 gap-1.5" onClick={onStart}>
          <Plus className="size-3.5" strokeWidth={2} />
          Start discussion
        </Button>
      </div>

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

// ─── Groups tab ───────────────────────────────────────────────────────────────

function GroupsTab({ onCreateGroup, refreshKey }: { onCreateGroup: () => void; refreshKey?: number }) {
  const supabase = createClient();
  const { user } = useAuthStore();
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);
  const [joinedIds, setJoinedIds] = React.useState<Set<string>>(new Set());
  const [groupFilter, setGroupFilter] = React.useState<"discover" | "mine">("discover");
  const [joiningId, setJoiningId] = React.useState<string | null>(null);
  const [leaveGroupId, setLeaveGroupId] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { gr, mr } = await withTimeout(
          (async () => {
            const gr = await supabase
              .from("groups")
              .select("*")
              .eq("is_public", true)
              .order("member_count", { ascending: false })
              .limit(20);
            const mr = user
              ? await supabase.from("group_members").select("group_id").eq("user_id", user.id)
              : { data: [] as { group_id: string }[] | null, error: null as Error | null };
            return { gr, mr };
          })(),
          COMMUNITY_FETCH_TIMEOUT_MS,
          "Request timed out",
        );
        if (cancelled) return;
        if (gr.error) throw new Error(gr.error.message);
        setGroups((gr.data ?? []) as Group[]);
        setJoinedIds(new Set((mr.data ?? []).map((m) => m.group_id)));
      } catch (e) {
        if (!cancelled) {
          setGroups([]);
          setError(e instanceof Error ? e.message : "Failed to load groups");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, retryKey, refreshKey]);

  async function handleJoin(groupId: string, group?: Group) {
    if (!user) { router.push("/auth/login"); return; }
    const isJoined = joinedIds.has(groupId);
    const isOwner = group?.creator_id === user.id;
    if (isJoined) {
      if (isOwner) return;
      setLeaveGroupId(groupId);
      return;
    }
    setJoiningId(groupId);
    await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
    setJoinedIds((prev) => new Set([...prev, groupId]));
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, member_count: g.member_count + 1 } : g));
    setJoiningId(null);
  }

  async function confirmLeaveGroup() {
    if (!user || !leaveGroupId) return;
    const groupId = leaveGroupId;
    setLeaveGroupId(null);
    setJoiningId(groupId);
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    setJoinedIds((prev) => { const n = new Set(prev); n.delete(groupId); return n; });
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g));
    setJoiningId(null);
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-14 text-center ring-1 ring-border px-6">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
          <Users className="size-7 text-accent" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] font-semibold text-foreground">Be the first to create a Vodex builder group</p>
        <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
          No groups are available yet. Start a collective or explore discussions while the community grows.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="accent" size="sm" className="gap-1.5" onClick={onCreateGroup}>
            <Plus className="size-3.5" strokeWidth={2} />
            Create first group
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRetryKey((k) => k + 1)}>
            Retry load
          </Button>
        </div>
      </div>
    );
  }

  const visibleGroups =
    groupFilter === "mine" ? groups.filter((g) => joinedIds.has(g.id)) : groups;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setGroupFilter("discover")}
          className={cn("rounded-full px-3 py-1 text-[12px] font-medium ring-1", groupFilter === "discover" ? "bg-accent text-white ring-accent" : "ring-border text-muted-foreground")}
        >
          Discover
        </button>
        <button
          type="button"
          onClick={() => setGroupFilter("mine")}
          className={cn("rounded-full px-3 py-1 text-[12px] font-medium ring-1", groupFilter === "mine" ? "bg-accent text-white ring-accent" : "ring-border text-muted-foreground")}
        >
          My groups
        </button>
      </div>
      {visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-14 text-center ring-1 ring-border px-6">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
            <Users className="size-7 text-accent" strokeWidth={1.5} />
          </div>
          <p className="text-[15px] font-semibold text-foreground">Be the first to create a Vodex builder group</p>
          <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
            Start a builder collective around your stack, niche, or product category — or explore discussions while you wait.
          </p>
          <Button variant="accent" size="sm" className="mt-6 gap-1.5" onClick={onCreateGroup}>
            <Plus className="size-3.5" strokeWidth={2} />
            Create group
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleGroups.map((g) => {
            const isJoined = joinedIds.has(g.id);
            const isOwner = g.creator_id === user?.id;
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "group cursor-pointer overflow-hidden rounded-[var(--radius-xl)] bg-surface ring-1 transition",
                  g.is_featured ? "ring-accent/30" : "ring-border hover:ring-accent/30",
                )}
              >
                {/* Banner */}
                <div className="h-16 w-full relative" style={{ background: g.banner_color }}>
                  {g.is_featured && (
                    <span className="absolute top-2 right-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      Featured
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-2 ring-accent -mt-7"
                        style={{ background: g.icon_url ? undefined : `${g.banner_color}33` }}
                      >
                        {g.icon_url ? (
                          <img src={g.icon_url} alt={g.name} className="size-full object-cover" />
                        ) : (
                          <Users className="size-4 text-white" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="mt-0">
                        <p className="text-[13.5px] font-semibold text-foreground">{g.name}</p>
                        <p className="text-[11px] text-muted-foreground">{g.member_count.toLocaleString()} members</p>
                      </div>
                    </div>
                  </div>
                  <GroupCategoryBadges
                    categories={parseGroupCategories(g)}
                    className="mt-2"
                    compact
                  />
                  {g.description && (
                    <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">{g.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    {!isOwner ? (
                      <button
                        type="button"
                        onClick={() => void handleJoin(g.id, g)}
                        disabled={joiningId === g.id}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-[11.5px] font-semibold ring-1 transition",
                          isJoined
                            ? "bg-muted/60 text-muted-foreground ring-border hover:bg-destructive/10 hover:text-destructive hover:ring-destructive/20"
                            : "bg-accent/10 text-accent ring-accent/20 hover:bg-accent/20",
                        )}
                      >
                        {joiningId === g.id ? <Loader2 className="size-3 animate-spin inline" /> : isJoined ? "Leave" : "Join"}
                      </button>
                    ) : (
                      <span className="rounded-lg bg-accent/10 px-3 py-1.5 text-[11.5px] font-semibold text-accent ring-1 ring-accent/20">Owner</span>
                    )}
                    <Link
                      href={`/community/groups/${g.id}`}
                      className="rounded-lg bg-surface-raised px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground ring-1 ring-border transition hover:text-foreground"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(leaveGroupId)}
        title="Leave this group?"
        description="You can rejoin anytime from the groups list."
        confirmLabel="Leave group"
        destructive
        onConfirm={() => void confirmLeaveGroup()}
        onCancel={() => setLeaveGroupId(null)}
      />

      {/* Create group CTA */}
      <div
        className="rounded-[var(--radius-xl)] border-2 border-dashed border-border p-6 text-center transition hover:border-accent/30 cursor-pointer"
        onClick={onCreateGroup}
      >
        <p className="text-[13.5px] font-semibold text-foreground">Start a builder collective</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Create a group around a niche, stack, or product category.</p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-accent/90"
          onClick={(e) => { e.stopPropagation(); onCreateGroup(); }}
        >
          Create a group
        </button>
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
  const [discussionsLoading, setDiscussionsLoading] = React.useState(true);
  const [discussionsError, setDiscussionsError] = React.useState<string | null>(null);
  const [discussionsRetryKey, setDiscussionsRetryKey] = React.useState(0);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showCreateGroup, setShowCreateGroup] = React.useState(false);
  const [groupsRefreshKey, setGroupsRefreshKey] = React.useState(0);
  const [likedIds, setLikedIds] = React.useState<Set<string>>(new Set());
  const [openDiscussion, setOpenDiscussion] = React.useState<DiscussionWithAuthor | null>(null);

  React.useEffect(() => {
    if (tab !== "Discussions" && tab !== "Trending") {
      return;
    }

    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- discussions fetch lifecycle */
    setDiscussionsLoading(true);
    setDiscussionsError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    (async () => {
      try {
        const [discRes, likesRes] = await withTimeout(
          Promise.all([
            supabase
              .from("discussions")
              .select("*")
              .order("is_pinned", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(COMMUNITY_DISCUSSIONS_LIMIT),
            user
              ? supabase.from("discussion_likes").select("discussion_id").eq("user_id", user.id)
              : Promise.resolve({ data: [] as { discussion_id: string }[] | null, error: null }),
          ]),
          COMMUNITY_FETCH_TIMEOUT_MS,
          "Request timed out",
        );
        if (cancelled) return;
        if (discRes.error) throw new Error(discRes.error.message);
        const likes = likesRes.data ?? [];
        const liked = new Set(likes.map((l: { discussion_id: string }) => l.discussion_id));
        setLikedIds(liked);
        const rows = (discRes.data ?? []) as Discussion[];
        const userIds = [...new Set(rows.map((d) => d.user_id))];
        const { data: profiles } = userIds.length
          ? await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", userIds)
          : { data: [] as { id: string; full_name: string | null; username: string | null; avatar_url: string | null }[] };
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        setDiscussions(
          rows.map((d) => {
            const p = profileMap.get(d.user_id);
            return {
              ...d,
              liked: liked.has(d.id),
              author_name: p?.full_name ?? p?.username ?? "Community member",
              author_username: p?.username ?? null,
              author_avatar: p?.avatar_url ?? undefined,
            };
          }),
        );
      } catch (e) {
        if (!cancelled) {
          setDiscussions([]);
          setDiscussionsError(e instanceof Error ? e.message : "Failed to load discussions");
        }
      } finally {
        if (!cancelled) setDiscussionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, user?.id, discussionsRetryKey]);

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
    setOpenDiscussion((prev) =>
      prev && prev.id === discussionId
        ? { ...prev, liked: !isLiked, like_count: prev.like_count + (isLiked ? -1 : 1) }
        : prev,
    );
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(discussionId);
      else next.add(discussionId);
      return next;
    });

    try {
      const res = await fetch(`/api/community/discussions/${discussionId}/like`, {
        method: isLiked ? "DELETE" : "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { likeCount?: number };
      if (typeof j.likeCount === "number") {
        setDiscussions((prev) =>
          prev.map((d) => (d.id === discussionId ? { ...d, like_count: j.likeCount! } : d)),
        );
        setOpenDiscussion((prev) =>
          prev && prev.id === discussionId ? { ...prev, like_count: j.likeCount! } : prev,
        );
      }
    } catch {
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId
            ? { ...d, liked: isLiked, like_count: d.like_count + (isLiked ? 1 : -1) }
            : d,
        ),
      );
      setOpenDiscussion((prev) =>
        prev && prev.id === discussionId
          ? { ...prev, liked: isLiked, like_count: prev.like_count + (isLiked ? 1 : -1) }
          : prev,
      );
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(discussionId);
        else next.delete(discussionId);
        return next;
      });
    }
  }

  function handleCreated(d: Discussion) {
    const profileName = useAuthStore.getState().profile?.full_name ?? user?.email?.split("@")[0] ?? "You";
    setDiscussions((prev) => [{ ...d, author_name: profileName, liked: false }, ...prev]);
    setTab("Discussions");
  }

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[min(100%,90rem)]">
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
          {tab === "Groups" ? (
            <Button variant="accent" size="md" onClick={() => setShowCreateGroup(true)} disabled={!user}>
              <Plus className="size-4" strokeWidth={1.75} />
              Create group
            </Button>
          ) : (
            <Button variant="accent" size="md" onClick={() => setShowCreate(true)} disabled={!user}>
              <Plus className="size-4" strokeWidth={1.75} />
              Start discussion
            </Button>
          )}
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
          {discussionsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50 ring-1 ring-border" />
              ))}
            </div>
          ) : discussionsError ? (
            <DiscussionsInlineFallback
              message="Couldn't load discussions yet."
              onRetry={() => setDiscussionsRetryKey((k) => k + 1)}
              onStartDiscussion={() => setShowCreate(true)}
            />
          ) : (
            <TrendingTab
              onStartDiscussion={() => { setTab("Discussions"); setShowCreate(true); }}
              discussions={discussions}
              onOpen={(disc) => setOpenDiscussion(disc)}
            />
          )}
        </motion.div>
      )}

      {/* Community apps tab */}
      {tab === "Community" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          <CommunityAppsTab />
        </motion.div>
      )}

      {/* Groups tab */}
      {tab === "Groups" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          <GroupsTab onCreateGroup={() => setShowCreateGroup(true)} refreshKey={groupsRefreshKey} />
        </motion.div>
      )}

      {/* Discussions tab */}
      {tab === "Discussions" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          {discussionsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50 ring-1 ring-border" />
              ))}
            </div>
          ) : discussionsError ? (
            <DiscussionsInlineFallback
              message="Couldn't load discussions yet."
              onRetry={() => setDiscussionsRetryKey((k) => k + 1)}
              onStartDiscussion={() => setShowCreate(true)}
            />
          ) : discussions.length === 0 ? (
            <EmptyDiscussions onStart={() => setShowCreate(true)} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {discussions.map((disc) => (
                <DiscussionCard
                  key={disc.id}
                  disc={disc}
                  onLike={handleLike}
                  onOpen={setOpenDiscussion}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Builders tab */}
      {tab === "Builders" && (
        <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mt-6">
          <BuildersTab onExploreCommunity={() => setTab("Discussions")} />
        </motion.div>
      )}

      {/* Create discussion modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateDiscussionModal
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>

      {/* Create group modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <CreateGroupModal
            onClose={() => setShowCreateGroup(false)}
            onCreated={() => {
              setTab("Groups");
              setShowCreateGroup(false);
              setGroupsRefreshKey((k) => k + 1);
            }}
          />
        )}
      </AnimatePresence>

      {openDiscussion ? (
        <DiscussionDetailDrawer
          discussion={openDiscussion}
          authorName={openDiscussion.author_name ?? "Community member"}
          authorAvatar={openDiscussion.author_avatar}
          liked={openDiscussion.liked}
          onClose={() => setOpenDiscussion(null)}
          onLikeToggle={() => void handleLike(openDiscussion.id)}
        />
      ) : null}

    </div>
  );
}

// ─── Trending tab ─────────────────────────────────────────────────────────────

function TrendingTab({
  onStartDiscussion,
  discussions,
  onOpen,
}: {
  onStartDiscussion: () => void;
  discussions: DiscussionWithAuthor[];
  onOpen: (disc: DiscussionWithAuthor) => void;
}) {
  const trending = sortByTrending(discussions).slice(0, 10);

  if (trending.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-12 text-center ring-1 ring-border">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
          <Flame className="size-7 text-accent" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] font-semibold text-foreground">Trending picks up as posts roll in</p>
        <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
          The most liked, shared, and discussed content rises here automatically. Start the conversation.
        </p>
        <Button variant="accent" size="sm" className="mt-6 gap-1.5" onClick={onStartDiscussion}>
          <Sparkles className="size-3.5" strokeWidth={1.75} />
          Start a discussion
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] bg-surface ring-1 ring-border divide-y divide-border/60">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Flame className="size-4 text-orange-500" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold text-foreground">Hot this week</p>
      </div>
      {trending.map((disc, i) => (
        <button
          type="button"
          key={disc.id}
          onClick={() => onOpen(disc)}
          className="flex w-full items-start gap-4 px-5 py-3 text-left transition hover:bg-muted/20"
        >
          <span className="shrink-0 w-5 text-[12px] font-bold text-muted-foreground/40 tabular-nums pt-0.5">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground leading-snug">{disc.title}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_COLORS[disc.category] ?? CATEGORY_COLORS.General)}>
                {disc.category}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="size-3" strokeWidth={1.5} />
                {disc.like_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" strokeWidth={1.5} />
                {disc.reply_count}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Community apps tab ───────────────────────────────────────────────────────

function CommunityAppsTab() {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-12 text-center ring-1 ring-border px-6">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
        <Rocket className="size-7 text-accent" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-foreground">Ship your first app to appear here</p>
      <p className="mt-2 max-w-md text-[13px] text-muted-foreground leading-relaxed">
        Apps built on Vodex that are marked public will surface in this feed. Create something incredible and let the community discover it.
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
  );
}

// ─── Builders tab ─────────────────────────────────────────────────────────────

function BuildersTab({ onExploreCommunity }: { onExploreCommunity: () => void }) {
  const [builders, setBuilders] = React.useState<
    Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      rankLabel: string;
      followerCount: number;
      bio: string | null;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void fetch("/api/community/builders", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setBuilders(j.builders ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  if (builders.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] bg-surface px-6 py-14 text-center ring-1 ring-border">
        <p className="text-[15px] font-semibold text-foreground">No public builder profiles yet</p>
        <p className="mt-2 text-[13px] text-muted-foreground">Enable your public profile in settings to appear here.</p>
        <Button variant="accent" size="sm" className="mt-4" type="button" onClick={onExploreCommunity}>
          Explore discussions
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {builders.map((b) => (
        <Link
          key={b.id}
          href={`/builders/${b.username}`}
          className="rounded-[var(--radius-xl)] bg-surface p-4 ring-1 ring-border transition hover:ring-accent/30"
        >
          <div className="flex items-center gap-3">
            <Avatar name={b.displayName} src={b.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">{b.displayName}</p>
              <p className="text-[11px] text-muted-foreground">@{b.username}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] font-medium text-blue-600">{b.rankLabel}</p>
          {b.bio ? <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{b.bio}</p> : null}
          <p className="mt-2 text-[11px] text-muted-foreground">{b.followerCount} followers</p>
        </Link>
      ))}
    </div>
  );
}
