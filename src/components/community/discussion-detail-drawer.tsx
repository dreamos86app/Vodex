"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Discussion } from "@/lib/supabase/types";
import { CommunityHeartButton } from "@/components/community/community-heart-button";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  like_count: number;
  parent_reply_id: string | null;
  author_name?: string;
  liked?: boolean;
};

function commentScore(c: CommentRow): number {
  const likes = c.like_count ?? 0;
  const ageH = (Date.now() - new Date(c.created_at).getTime()) / 3_600_000;
  const recency = Math.max(0, 48 - ageH) / 48;
  return likes * 3 + recency * 2 + Math.random() * 0.15;
}

function CommentItem({
  comment,
  replies,
  userId,
  onLike,
  onReply,
  depth = 0,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  userId?: string;
  onLike: (id: string, liked: boolean) => void;
  onReply: (parentId: string, text: string) => Promise<void>;
  depth?: number;
}) {
  const [showReplies, setShowReplies] = React.useState(false);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [replying, setReplying] = React.useState(false);

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;
    setReplying(true);
    try {
      await onReply(comment.id, text);
      setReplyText("");
      setReplyOpen(false);
      setShowReplies(true);
    } finally {
      setReplying(false);
    }
  }

  return (
    <li className={cn(depth > 0 && "ml-4 border-l-2 border-border/60 pl-3")}>
      <div className="rounded-xl bg-surface/80 px-3 py-2.5 ring-1 ring-border/60">
        <p className="text-[11px] font-medium text-muted-foreground">{comment.author_name ?? "Member"}</p>
        <p className="mt-1 text-[13px] text-foreground">{comment.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CommunityHeartButton
            liked={!!comment.liked}
            count={comment.like_count}
            onToggle={() => onLike(comment.id, !!comment.liked)}
            size="sm"
          />
          {userId ? (
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              <MessageCircle className="size-3" strokeWidth={1.75} />
              Reply
            </button>
          ) : null}
        </div>
        {replyOpen && userId ? (
          <form onSubmit={(e) => void submitReply(e)} className="mt-2 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              className="min-w-0 flex-1 rounded-lg bg-background px-2.5 py-1.5 text-[12px] ring-1 ring-border"
            />
            <button
              type="submit"
              disabled={replying || !replyText.trim()}
              className="rounded-lg bg-accent px-2.5 py-1.5 text-white disabled:opacity-50"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        ) : null}
      </div>
      {replies.length > 0 && !showReplies ? (
        <button
          type="button"
          onClick={() => setShowReplies(true)}
          className="mt-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
        >
          View all {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </button>
      ) : null}
      {replies.length > 0 && showReplies ? (
        <ul className="mt-2 space-y-2">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              replies={[]}
              userId={userId}
              onLike={onLike}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function DiscussionDetailDrawer({
  discussion,
  authorName,
  authorAvatar,
  liked,
  onClose,
  onLikeToggle,
}: {
  discussion: Discussion;
  authorName: string;
  authorAvatar?: string | null;
  liked?: boolean;
  onClose: () => void;
  onLikeToggle: () => void;
}) {
  const supabase = createClient();
  const { user } = useAuthStore();
  const [comments, setComments] = React.useState<CommentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [localLiked, setLocalLiked] = React.useState(!!liked);
  const [localLikeCount, setLocalLikeCount] = React.useState(discussion.like_count);

  React.useEffect(() => {
    setLocalLiked(!!liked);
    setLocalLikeCount(discussion.like_count);
  }, [liked, discussion.like_count, discussion.id]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [commentsRes, likesRes] = await Promise.all([
        supabase
          .from("discussion_replies")
          .select("id, body, created_at, user_id, like_count, parent_reply_id")
          .eq("discussion_id", discussion.id)
          .order("created_at", { ascending: true }),
        user
          ? supabase.from("discussion_reply_likes").select("reply_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] as { reply_id: string }[] | null, error: null }),
      ]);
      if (cancelled) return;
      if (commentsRes.error) {
        toast.error("Could not load comments");
        setComments([]);
      } else {
        const likedIds = new Set((likesRes.data ?? []).map((l: { reply_id: string }) => l.reply_id));
        const rows = ((commentsRes.data ?? []) as CommentRow[]).map((c) => ({
          ...c,
          liked: likedIds.has(c.id),
        }));
        setComments([...rows].sort((a, b) => commentScore(b) - commentScore(a)));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [discussion.id, supabase, user?.id]);

  const topLevel = React.useMemo(
    () => comments.filter((c) => !c.parent_reply_id),
    [comments],
  );
  const repliesByParent = React.useMemo(() => {
    const map = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_reply_id) continue;
      const list = map.get(c.parent_reply_id) ?? [];
      list.push(c);
      map.set(c.parent_reply_id, list);
    }
    return map;
  }, [comments]);

  function handlePostLike() {
    setLocalLiked((v) => !v);
    setLocalLikeCount((n) => n + (localLiked ? -1 : 1));
    onLikeToggle();
  }

  async function handleCommentLike(commentId: string, isLiked: boolean) {
    if (!user) return;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, liked: !isLiked, like_count: c.like_count + (isLiked ? -1 : 1) }
          : c,
      ),
    );
    try {
      const res = await fetch(`/api/community/comments/${commentId}/like`, {
        method: isLiked ? "DELETE" : "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { likeCount?: number };
      if (typeof j.likeCount === "number") {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, like_count: j.likeCount! } : c)),
        );
      }
    } catch {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, liked: isLiked, like_count: c.like_count + (isLiked ? 1 : -1) }
            : c,
        ),
      );
    }
  }

  async function handleCommentReply(parentId: string, text: string) {
    if (!user) return;
    const res = await fetch(`/api/community/comments/${parentId}/reply`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const j = (await res.json()) as { reply?: CommentRow; error?: string };
    if (!res.ok || !j.reply) {
      toast.error(j.error ?? "Could not post reply");
      throw new Error(j.error ?? "reply failed");
    }
    setComments((prev) => [...prev, { ...j.reply!, author_name: "You", liked: false }]);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !user) return;
    setSaving(true);
    const optimistic: CommentRow = {
      id: `opt-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      user_id: user.id,
      like_count: 0,
      parent_reply_id: null,
      author_name: "You",
    };
    setComments((prev) => [...prev, optimistic]);
    setBody("");
    try {
      const { data, error } = await supabase
        .from("discussion_replies")
        .insert({ discussion_id: discussion.id, user_id: user.id, body: text })
        .select("id, body, created_at, user_id, like_count, parent_reply_id")
        .single();
      if (error) throw error;
      setComments((prev) =>
        prev
          .map((c) => (c.id === optimistic.id ? ({ ...data, author_name: "You" } as CommentRow) : c))
          .sort((a, b) => commentScore(b) - commentScore(a)),
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setBody(text);
      toast.error("Could not save comment");
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10050] lg:flex lg:justify-end" role="dialog" aria-modal="true">
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
          aria-label="Close"
          onClick={onClose}
        />
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-background shadow-2xl ring-1 ring-border lg:max-h-[100dvh]"
          data-testid="discussion-detail-drawer"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="truncate text-[14px] font-semibold">{discussion.title}</p>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="flex items-start gap-3">
              <Avatar name={authorName} src={authorAvatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-muted-foreground">{authorName}</p>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">{discussion.body}</p>
                <CommunityHeartButton
                  liked={localLiked}
                  count={localLikeCount}
                  onToggle={handlePostLike}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comments</p>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : topLevel.length === 0 ? (
                <p className="py-6 text-[13px] text-muted-foreground">No comments yet — start the thread.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {topLevel.map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      replies={repliesByParent.get(c.id) ?? []}
                      userId={user?.id}
                      onLike={handleCommentLike}
                      onReply={handleCommentReply}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
          {user ? (
            <form
              onSubmit={(e) => void submitComment(e)}
              className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
            >
              <div className="flex gap-2">
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Add a comment…"
                  className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2.5 text-[13px] ring-1 ring-border"
                />
                <button
                  type="submit"
                  disabled={saving || !body.trim()}
                  className="rounded-xl bg-accent px-3 py-2.5 text-white disabled:opacity-50"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </form>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
