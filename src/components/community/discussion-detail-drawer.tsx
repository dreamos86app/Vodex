"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageCircle, ImagePlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Discussion } from "@/lib/supabase/types";
import { CommunityHeartButton } from "@/components/community/community-heart-button";
import { fetchProfileNameMap, fetchProfilePreviewMap } from "@/lib/community/profile-display-name";
import { CommunityMessageMenu } from "@/components/community/community-message-menu";
import { ConfirmDialog } from "@/components/community/confirm-dialog";
import Link from "next/link";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  like_count: number;
  parent_reply_id: string | null;
  edited_at?: string | null;
  author_name?: string;
  author_avatar?: string | null;
  author_username?: string | null;
  liked?: boolean;
  attachment_url?: string | null;
};

function dedupeComments(rows: CommentRow[]): CommentRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

function AuthorLink({
  name,
  avatar,
  username,
  userId,
  currentUserId,
}: {
  name: string;
  avatar?: string | null;
  username?: string | null;
  userId: string;
  currentUserId?: string;
}) {
  const label = userId === currentUserId ? "You" : name;
  const inner = (
    <div className="flex items-center gap-2">
      <Avatar name={label} src={avatar ?? undefined} size="sm" />
      <span className="text-[12px] font-medium text-foreground">{label}</span>
    </div>
  );
  if (username && userId !== currentUserId) {
    return (
      <Link href={`/builders/${username}`} className="transition hover:opacity-80">
        {inner}
      </Link>
    );
  }
  return inner;
}

function commentScore(c: CommentRow): number {
  const likes = c.like_count ?? 0;
  const ageH = (Date.now() - new Date(c.created_at).getTime()) / 3_600_000;
  const recency = Math.max(0, 48 - ageH) / 48;
  return likes * 3 + recency * 2 + Math.random() * 0.15;
}

function FlatReply({
  reply,
  replyToName,
  userId,
  onLike,
  onEdit,
  onRequestDelete,
}: {
  reply: CommentRow;
  replyToName?: string;
  userId?: string;
  onLike: (id: string, liked: boolean) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onRequestDelete: (id: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(reply.body);
  const isOwn = userId === reply.user_id;

  return (
    <li className="relative ml-5 border-l-2 border-accent/30 pl-4">
      <div className="rounded-xl bg-background/80 px-3 py-2.5 ring-1 ring-border/60">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <AuthorLink
              name={reply.author_name ?? "Member"}
              avatar={reply.author_avatar}
              username={reply.author_username}
              userId={reply.user_id}
              currentUserId={userId}
            />
            {replyToName ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                <span className="font-semibold text-accent">→</span>{" "}
                <span className="font-medium">{replyToName}</span>
              </p>
            ) : null}
          </div>
          {isOwn ? (
            <CommunityMessageMenu onEdit={() => setEditing(true)} onDelete={() => onRequestDelete(reply.id)} />
          ) : null}
        </div>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onEdit(reply.id, draft.trim()).then(() => setEditing(false));
            }}
            className="mt-2 flex gap-2"
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-background px-2 py-1.5 text-[12px] ring-1 ring-border" />
            <button type="submit" className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px] text-white">Save</button>
          </form>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-foreground">{reply.body}</p>
        )}
        {reply.attachment_url ? (
          <img src={reply.attachment_url} alt="" className="mt-2 max-h-48 w-full rounded-lg object-cover" />
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CommunityHeartButton liked={!!reply.liked} count={reply.like_count} onToggle={() => onLike(reply.id, !!reply.liked)} size="sm" />
          {reply.edited_at ? <span className="text-[10px] text-muted-foreground">edited</span> : null}
        </div>
      </div>
    </li>
  );
}

function CommentItem({
  comment,
  flatReplies,
  nameById,
  userId,
  onLike,
  onReply,
  onEdit,
  onRequestDelete,
}: {
  comment: CommentRow;
  flatReplies: CommentRow[];
  nameById: Map<string, string>;
  userId?: string;
  onLike: (id: string, liked: boolean) => void;
  onReply: (parentId: string, text: string) => Promise<void>;
  onEdit: (id: string, text: string) => Promise<void>;
  onRequestDelete: (id: string) => void;
}) {
  const [showReplies, setShowReplies] = React.useState(true);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [replying, setReplying] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(comment.body);
  const isOwn = userId === comment.user_id;

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
    <li>
      <div className="rounded-xl bg-surface/80 px-3 py-2.5 ring-1 ring-border/60">
        <div className="flex items-start justify-between gap-2">
          <AuthorLink
            name={comment.author_name ?? "Member"}
            avatar={comment.author_avatar}
            username={comment.author_username}
            userId={comment.user_id}
            currentUserId={userId}
          />
          {isOwn ? (
            <CommunityMessageMenu onEdit={() => setEditing(true)} onDelete={() => onRequestDelete(comment.id)} />
          ) : null}
        </div>
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); void onEdit(comment.id, draft.trim()).then(() => setEditing(false)); }} className="mt-2 flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-background px-2.5 py-1.5 text-[12px] ring-1 ring-border" />
            <button type="submit" className="rounded-lg bg-accent px-2.5 py-1.5 text-white">Save</button>
          </form>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-foreground">{comment.body}</p>
        )}
        {comment.attachment_url ? (
          <img src={comment.attachment_url} alt="" className="mt-2 max-h-56 w-full rounded-lg object-cover" />
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CommunityHeartButton liked={!!comment.liked} count={comment.like_count} onToggle={() => onLike(comment.id, !!comment.liked)} size="sm" />
          {comment.edited_at ? <span className="text-[10px] text-muted-foreground">edited</span> : null}
          {userId ? (
            <button type="button" onClick={() => setReplyOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
              <MessageCircle className="size-3" strokeWidth={1.75} /> Reply
            </button>
          ) : null}
        </div>
        {replyOpen && userId ? (
          <form onSubmit={(e) => void submitReply(e)} className="mt-2 flex gap-2">
            <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply…" className="min-w-0 flex-1 rounded-lg bg-background px-2.5 py-1.5 text-[12px] ring-1 ring-border" />
            <button type="submit" disabled={replying || !replyText.trim()} className="rounded-lg bg-accent px-2.5 py-1.5 text-white disabled:opacity-50"><Send className="size-3.5" /></button>
          </form>
        ) : null}
      </div>
      {flatReplies.length > 0 && !showReplies ? (
        <button type="button" onClick={() => setShowReplies(true)} className="mt-1.5 text-[11px] text-muted-foreground transition hover:text-foreground">
          View all {flatReplies.length} {flatReplies.length === 1 ? "reply" : "replies"}
        </button>
      ) : null}
      {flatReplies.length > 0 && showReplies ? (
        <ul className="mt-3 space-y-2">
          {flatReplies.map((r) => {
            const parent = r.parent_reply_id ? nameById.get(r.parent_reply_id) : undefined;
            const replyToName = r.parent_reply_id && r.parent_reply_id !== comment.id ? parent : undefined;
            return (
              <FlatReply
                key={r.id}
                reply={r}
                replyToName={replyToName}
                userId={userId}
                onLike={onLike}
                onEdit={onEdit}
                onRequestDelete={onRequestDelete}
              />
            );
          })}
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
  const [attachment, setAttachment] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [localLiked, setLocalLiked] = React.useState(!!liked);
  const [localLikeCount, setLocalLikeCount] = React.useState(discussion.like_count);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLocalLiked(!!liked);
    setLocalLikeCount(discussion.like_count);
  }, [liked, discussion.like_count, discussion.id]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [discussion.id]);

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
        const raw = (commentsRes.data ?? []) as CommentRow[];
        const userIds = raw.map((c) => c.user_id);
        const [names, previews] = await Promise.all([
          fetchProfileNameMap(supabase, userIds),
          fetchProfilePreviewMap(supabase, userIds),
        ]);
        const rows = raw.map((c) => {
          const preview = previews.get(c.user_id);
          return {
            ...c,
            liked: likedIds.has(c.id),
            author_name: c.user_id === user?.id ? "You" : names.get(c.user_id) ?? "Member",
            author_avatar: preview?.avatar_url ?? null,
            author_username: preview?.username ?? null,
          };
        });
        setComments(dedupeComments([...rows].sort((a, b) => commentScore(b) - commentScore(a))));
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
    const byId = new Map(comments.map((c) => [c.id, c]));
    function topLevelParentId(row: CommentRow): string {
      let cur: CommentRow | undefined = row;
      while (cur?.parent_reply_id) {
        const parent = byId.get(cur.parent_reply_id);
        if (!parent?.parent_reply_id) return parent?.id ?? cur.parent_reply_id;
        cur = parent;
      }
      return row.parent_reply_id ?? row.id;
    }
    const map = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_reply_id) continue;
      const topId = topLevelParentId(c);
      const list = map.get(topId) ?? [];
      list.push(c);
      map.set(topId, list);
    }
    return map;
  }, [comments]);

  const nameById = React.useMemo(
    () => new Map(comments.map((c) => [c.id, c.author_name ?? "Member"])),
    [comments],
  );

  async function handleCommentEdit(commentId: string, text: string) {
    const res = await fetch(`/api/community/comments/${commentId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) { toast.error("Could not save edit"); return; }
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body: text, edited_at: new Date().toISOString() } : c)));
  }

  async function handleCommentDelete(commentId: string) {
    const res = await fetch(`/api/community/comments/${commentId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { toast.error("Could not delete"); return; }
    setComments((prev) => dedupeComments(prev.filter((c) => c.id !== commentId && c.parent_reply_id !== commentId)));
    setDeleteTargetId(null);
    toast.success("Comment deleted");
  }

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
    const preview = user ? await fetchProfilePreviewMap(supabase, [user.id]).then((m) => m.get(user.id)) : undefined;
    setComments((prev) =>
      dedupeComments([
        ...prev,
        {
          ...j.reply!,
          author_name: "You",
          author_avatar: preview?.avatar_url ?? null,
          author_username: preview?.username ?? null,
          liked: false,
        },
      ]),
    );
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !user) return;
    setSaving(true);
    let attachmentUrl: string | null = null;
    if (attachment) {
      const fd = new FormData();
      fd.append("file", attachment);
      const up = await fetch("/api/chat/attachments", { method: "POST", body: fd });
      const uj = (await up.json()) as { url?: string };
      if (uj.url) attachmentUrl = uj.url;
    }
    const optimistic: CommentRow = {
      id: `opt-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      user_id: user.id,
      like_count: 0,
      parent_reply_id: null,
      author_name: "You",
      attachment_url: attachmentUrl,
    };
    setComments((prev) => dedupeComments([...prev, optimistic]));
    setBody("");
    setAttachment(null);
    try {
      const { data, error } = await supabase
        .from("discussion_replies")
        .insert({ discussion_id: discussion.id, user_id: user.id, body: text })
        .select("id, body, created_at, user_id, like_count, parent_reply_id")
        .single();
      if (error) throw error;
      if (attachmentUrl && data?.id) {
        await (supabase as any).from("discussion_attachments").insert({
          reply_id: data.id,
          user_id: user.id,
          url: attachmentUrl,
        });
      }
      const preview = user ? await fetchProfilePreviewMap(supabase, [user.id]).then((m) => m.get(user.id)) : undefined;
      setComments((prev) =>
        dedupeComments(
          prev
            .map((c) =>
              c.id === optimistic.id
                ? ({
                    ...data,
                    author_name: "You",
                    author_avatar: preview?.avatar_url ?? null,
                    author_username: preview?.username ?? null,
                  } as CommentRow)
                : c,
            )
            .sort((a, b) => commentScore(b) - commentScore(a)),
        ),
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
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
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
                      flatReplies={repliesByParent.get(c.id) ?? []}
                      nameById={nameById}
                      userId={user?.id}
                      onLike={handleCommentLike}
                      onReply={handleCommentReply}
                      onEdit={handleCommentEdit}
                      onRequestDelete={setDeleteTargetId}
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
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-surface px-3 py-2.5 ring-1 ring-border" aria-label="Attach image">
                  <ImagePlus className="size-4 text-muted-foreground" />
                </button>
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
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
              {attachment ? <p className="mt-1 text-[11px] text-muted-foreground">Attached: {attachment.name}</p> : null}
            </form>
          ) : null}
        </motion.div>
        <ConfirmDialog
          open={Boolean(deleteTargetId)}
          title="Delete this comment?"
          description="This cannot be undone. Replies to this comment will also be removed from the thread."
          confirmLabel="Delete comment"
          destructive
          onConfirm={() => deleteTargetId && void handleCommentDelete(deleteTargetId)}
          onCancel={() => setDeleteTargetId(null)}
        />
      </div>
    </AnimatePresence>,
    document.body,
  );
}
