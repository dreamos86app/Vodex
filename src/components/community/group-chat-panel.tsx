"use client";

import * as React from "react";
import { Loader2, Send, Smile, Reply } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { fetchProfileNameMap, fetchProfilePreviewMap, profileDisplayName } from "@/lib/community/profile-display-name";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type ReactionRow = { emoji: string; user_id: string };

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_message_id?: string | null;
  author_name?: string;
  author_avatar?: string | null;
  author_username?: string | null;
  reactions?: ReactionRow[];
};

type ReactorPreview = { userId: string; name: string; avatar: string | null; username: string | null };

const QUICK_REACTIONS = ["👍", "❤️", "🔥", "😂", "🎉"];

export function GroupChatPanel({
  groupId,
  joined,
}: {
  groupId: string;
  joined: boolean;
}) {
  const supabase = createClient();
  const { user, profile } = useAuthStore();
  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<MessageRow | null>(null);
  const [typingUsers, setTypingUsers] = React.useState<{ userId: string; name: string }[]>([]);
  const [reactionPickerFor, setReactionPickerFor] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const channelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [reactionViewer, setReactionViewer] = React.useState<{ messageId: string; emoji: string } | null>(null);
  const [reactors, setReactors] = React.useState<ReactorPreview[]>([]);
  const initialScrollDoneRef = React.useRef(false);

  const enrichMessages = React.useCallback(
    async (rows: MessageRow[]) => {
      const ids = rows.map((m) => m.user_id);
      const [names, previews] = await Promise.all([
        fetchProfileNameMap(supabase, ids),
        fetchProfilePreviewMap(supabase, ids),
      ]);
      return rows.map((m) => {
        const preview = previews.get(m.user_id);
        return {
          ...m,
          author_name: m.user_id === user?.id ? "You" : names.get(m.user_id) ?? "Member",
          author_avatar: preview?.avatar_url ?? null,
          author_username: preview?.username ?? null,
        };
      });
    },
    [supabase, user?.id],
  );

  const loadMessages = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("group_messages" as never)
      .select("id, body, created_at, user_id, parent_message_id")
      .eq("group_id" as never, groupId)
      .eq("is_deleted" as never, false)
      .order("created_at", { ascending: true })
      .limit(120);
    if (error) {
      setMessages([]);
      return;
    }
    const base = (data ?? []) as unknown as MessageRow[];
    const enriched = await enrichMessages(base);

    const ids = base.map((m) => m.id);
    if (ids.length) {
      const { data: rxn } = await supabase
        .from("group_message_reactions" as never)
        .select("message_id, emoji, user_id")
        .in("message_id" as never, ids);
      const byMsg = new Map<string, ReactionRow[]>();
      for (const r of (rxn ?? []) as unknown as (ReactionRow & { message_id: string })[]) {
        const list = byMsg.get(r.message_id) ?? [];
        list.push({ emoji: r.emoji, user_id: r.user_id });
        byMsg.set(r.message_id, list);
      }
      setMessages(enriched.map((m) => ({ ...m, reactions: byMsg.get(m.id) ?? [] })));
    } else {
      setMessages(enriched);
    }
  }, [enrichMessages, groupId, supabase]);

  React.useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [groupId]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadMessages();
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase.channel(`group-chat:${groupId}`, { config: { broadcast: { self: false } } });
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          void enrichMessages([row]).then(([enriched]) => {
            setMessages((prev) => (prev.some((m) => m.id === enriched.id) ? prev : [...prev, { ...enriched, reactions: [] }]));
          });
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const p = payload.payload as { userId?: string; name?: string };
        if (!p.userId || p.userId === user?.id) return;
        setTypingUsers((prev) => [...prev.filter((t) => t.userId !== p.userId), { userId: p.userId!, name: p.name ?? "Someone" }]);
        window.setTimeout(() => setTypingUsers((prev) => prev.filter((t) => t.userId !== p.userId)), 2800);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enrichMessages, groupId, loadMessages, supabase, user?.id]);

  const isNearBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      el.scrollTop = 0;
      return;
    }
    if (isNearBottom()) {
      el.scrollTop = el.scrollHeight;
      setUnreadCount(0);
    } else {
      setUnreadCount((n) => n + 1);
    }
  }, [messages.length, typingUsers.length, isNearBottom, loading]);

  React.useEffect(() => {
    if (!reactionViewer) return;
    const msg = messages.find((m) => m.id === reactionViewer.messageId);
    const userIds = (msg?.reactions ?? [])
      .filter((r) => r.emoji === reactionViewer.emoji)
      .map((r) => r.user_id);
    void Promise.all([fetchProfileNameMap(supabase, userIds), fetchProfilePreviewMap(supabase, userIds)]).then(
      ([names, previews]) => {
        setReactors(
          userIds.map((id) => {
            const preview = previews.get(id);
            return {
              userId: id,
              name: id === user?.id ? "You" : names.get(id) ?? "Member",
              avatar: preview?.avatar_url ?? null,
              username: preview?.username ?? null,
            };
          }),
        );
      },
    );
  }, [reactionViewer, messages, supabase, user?.id]);

  async function toggleReaction(messageId: string, emoji: string) {
    if (!user) return;
    const msg = messages.find((m) => m.id === messageId);
    const has = msg?.reactions?.some((r) => r.user_id === user.id && r.emoji === emoji);
    if (has) {
      await supabase
        .from("group_message_reactions" as never)
        .delete()
        .eq("message_id" as never, messageId)
        .eq("user_id" as never, user.id)
        .eq("emoji" as never, emoji);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, reactions: (m.reactions ?? []).filter((r) => !(r.user_id === user.id && r.emoji === emoji)) }
            : m,
        ),
      );
    } else {
      await supabase.from("group_message_reactions" as never).insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      } as never);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, reactions: [...(m.reactions ?? []), { emoji, user_id: user.id }] }
            : m,
        ),
      );
    }
    setReactionPickerFor(null);
  }

  async function send() {
    const text = body.trim();
    if (!text || !user || !joined) return;
    setSending(true);
    const optimistic: MessageRow = {
      id: `opt-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      user_id: user.id,
      parent_message_id: replyTo?.id ?? null,
      author_name: profileDisplayName(profile, "You"),
      reactions: [],
    };
    const parentMessageId = replyTo?.id ?? null;
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setReplyTo(null);
    try {
      const res = await fetch(`/api/community/groups/${groupId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, parentMessageId }),
      });
      const j = (await res.json()) as { message?: MessageRow; error?: string };
      if (!res.ok || !j.message) throw new Error(j.error ?? "Send failed");
      const enriched = await enrichMessages([j.message]);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...enriched[0], reactions: [] } : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(text);
      toast.error("Could not send message");
    } finally {
      setSending(false);
    }
  }

  if (!joined) {
    return (
      <div className="rounded-2xl bg-surface px-4 py-8 text-center ring-1 ring-border">
        <p className="text-[13px] text-muted-foreground">Join this group to send messages.</p>
      </div>
    );
  }

  const msgById = new Map(messages.map((m) => [m.id, m]));

  return (
    <div className="flex h-[min(520px,65vh)] flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-border" data-testid="group-chat-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-[11px] font-semibold text-muted-foreground">Group chat</p>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Live</span>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) el.scrollTop = el.scrollHeight;
              setUnreadCount(0);
            }}
            className="sticky top-2 z-10 mx-auto mb-2 block rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white shadow"
          >
            {unreadCount} new message{unreadCount === 1 ? "" : "s"}
          </button>
        ) : null}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-muted-foreground">No messages yet — say hello.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.user_id === user?.id;
              const parent = m.parent_message_id ? msgById.get(m.parent_message_id) : null;
              const reactionCounts = (m.reactions ?? []).reduce<Record<string, number>>((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                return acc;
              }, {});
              return (
                <li key={m.id} className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row", parent && !mine && "ml-5 border-l-2 border-accent/25 pl-3")}>
                  <Avatar name={m.author_name ?? "Member"} src={m.author_avatar ?? (mine ? profile?.avatar_url : undefined)} size="sm" />
                  <div className={cn("max-w-[80%] space-y-1", mine && "items-end")}>
                    {m.author_username && !mine ? (
                      <Link href={`/builders/${m.author_username}`} className="text-[10px] font-medium text-muted-foreground hover:text-accent">
                        {m.author_name}
                      </Link>
                    ) : (
                      <p className="text-[10px] font-medium text-muted-foreground">{m.author_name}</p>
                    )}
                    {parent ? (
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-medium">{m.author_name}</span>
                        <span className="mx-1 text-accent">→</span>
                        <span>{parent.author_name ?? "Member"}</span>
                      </p>
                    ) : null}
                    <div className={cn("rounded-2xl px-3 py-2 text-[13px] leading-relaxed", mine ? "bg-accent text-white" : "bg-muted/50 text-foreground")}>
                      <p>
                        {m.body.split(/(@[a-zA-Z0-9_]{2,32})/g).map((part, i) =>
                          part.startsWith("@") ? (
                            <span key={i} className={cn("font-semibold", mine ? "text-white underline" : "text-accent")}>{part}</span>
                          ) : (
                            <React.Fragment key={i}>{part}</React.Fragment>
                          ),
                        )}
                      </p>
                      <p className={cn("mt-1 text-[9px] opacity-70", mine ? "text-right text-white/80" : "text-muted-foreground")}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className={cn("flex flex-wrap items-center gap-1", mine && "justify-end")}>
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setReactionViewer({ messageId: m.id, emoji })}
                          onContextMenu={(e) => { e.preventDefault(); void toggleReaction(m.id, emoji); }}
                          className="rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] ring-1 ring-border"
                        >
                          {emoji} {count}
                        </button>
                      ))}
                      <button type="button" onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                        <Smile className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setReplyTo(m)} className="inline-flex items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] text-muted-foreground hover:text-foreground">
                        <Reply className="size-3" /> Reply
                      </button>
                    </div>
                    {reactionPickerFor === m.id ? (
                      <div className="flex gap-1">
                        {QUICK_REACTIONS.map((e) => (
                          <button key={e} type="button" onClick={() => void toggleReaction(m.id, e)} className="rounded-lg bg-background px-2 py-1 text-sm ring-1 ring-border hover:bg-muted">{e}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {typingUsers.length > 0 ? (
        <p className="px-3 pb-1 text-[11px] text-muted-foreground">{typingUsers.map((t) => t.name).join(", ")} typing…</p>
      ) : null}

      {replyTo ? (
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5 text-[11px]">
          <span>Replying to <strong>{replyTo.author_name}</strong></span>
          <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      ) : null}

      <AnimatePresence>
        {reactionViewer ? (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="border-t-2 border-accent/40 bg-white px-4 py-3 shadow-[0_-8px_30px_rgba(79,124,255,0.12)] dark:bg-background"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-foreground">
                <span className="mr-1.5 text-lg">{reactionViewer.emoji}</span>
                Reactions
              </p>
              <button type="button" onClick={() => setReactionViewer(null)} className="text-[11px] text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            <ul className="max-h-40 space-y-2 overflow-y-auto">
              {reactors.map((r) => (
                <li key={r.userId} className="flex items-center justify-between gap-2 rounded-xl bg-accent/5 px-2.5 py-2 ring-1 ring-accent/15">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={r.name} src={r.avatar ?? undefined} size="sm" />
                    {r.username && r.userId !== user?.id ? (
                      <Link href={`/builders/${r.username}`} className="truncate text-[12px] font-medium hover:text-accent">
                        {r.name}
                      </Link>
                    ) : (
                      <span className="truncate text-[12px] font-medium">{r.name}</span>
                    )}
                  </div>
                  {r.userId === user?.id ? (
                    <button
                      type="button"
                      onClick={() => void toggleReaction(reactionViewer.messageId, reactionViewer.emoji)}
                      className="shrink-0 text-[11px] font-medium text-destructive"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-2 border-t border-border px-3 py-3">
        <textarea
          value={body}
          rows={1}
          onChange={(e) => {
            setBody(e.target.value);
            if (channelRef.current && user) {
              void channelRef.current.send({
                type: "broadcast",
                event: "typing",
                payload: { userId: user.id, name: profileDisplayName(profile, "You") },
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message the group…"
          className="min-w-0 flex-1 resize-none rounded-xl bg-background px-3 py-2.5 text-[13px] ring-1 ring-border"
        />
        <button type="submit" disabled={sending || !body.trim()} className="rounded-xl bg-accent px-3 py-2.5 text-white disabled:opacity-50">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
