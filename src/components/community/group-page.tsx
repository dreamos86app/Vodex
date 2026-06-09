"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Users, Plus, MessageCircle, Loader2,
  Lock, Globe, UserCheck, UserPlus, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { GroupChatPanel } from "@/components/community/group-chat-panel";
import { GroupCategoryBadges, parseGroupCategories } from "@/components/community/group-category-badges";

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

interface GroupMember {
  user_id: string;
  role: string;
  joined_at: string;
  profiles?: { full_name: string | null; email: string; avatar_url: string | null };
}

export function GroupPageClient({ groupId }: { groupId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuthStore();

  const [group, setGroup] = React.useState<Group | null>(null);
  const [members, setMembers] = React.useState<GroupMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [joined, setJoined] = React.useState(false);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const [{ data: grp }, { data: mems }] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).single(),
        supabase
          .from("group_members")
          .select("*, profiles(full_name, email, avatar_url)")
          .eq("group_id", groupId)
          .order("joined_at", { ascending: true })
          .limit(20),
      ]);

      if (!grp) { setError("Group not found."); setLoading(false); return; }
      setGroup(grp as unknown as Group);
      setMembers((mems ?? []) as unknown as GroupMember[]);

      if (user) {
        const isMember = (mems ?? []).some((m: unknown) => (m as GroupMember).user_id === user.id);
        setJoined(isMember);
      }
      setLoading(false);
    }
    load();
  }, [groupId, user?.id]);

  async function handleJoin() {
    if (!user) { router.push("/auth/login"); return; }
    setJoining(true);
    if (joined) {
      await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
      setJoined(false);
      setGroup((g) => g ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g);
    } else {
      await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
      setJoined(true);
      setGroup((g) => g ? { ...g, member_count: g.member_count + 1 } : g);
    }
    setJoining(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-[14px] text-muted-foreground">{error ?? "Group not found."}</p>
        <Link href="/community" className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
          <ArrowLeft className="size-3.5" /> Back to Community
        </Link>
      </div>
    );
  }

  const isCreator = user?.id === group.creator_id;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Back link */}
      <Link href="/community" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        Community
      </Link>

      {/* Banner */}
      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        className="overflow-hidden rounded-[var(--radius-2xl)] bg-surface ring-1 ring-border"
      >
        {/* Color banner */}
        <div
          className="h-32 w-full sm:h-44"
          style={{ background: group.banner_color }}
        />

        {/* Group info */}
        <div className="relative px-5 pb-5 sm:px-6">
          {/* Icon overlapping banner */}
          <div className="relative -mt-10 mb-4 flex items-end justify-between gap-4">
            <div
              className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-4 ring-accent"
              style={{ background: group.icon_url ? undefined : "rgba(255,255,255,0.15)" }}
            >
              {group.icon_url ? (
                <img src={group.icon_url} alt={group.name} className="size-full object-cover" />
              ) : (
                <Users className="size-8 text-white" strokeWidth={1.5} />
              )}
            </div>

            <div className="flex items-center gap-2 pt-12">
              {isCreator && (
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Settings className="size-3.5" strokeWidth={1.75} />
                  Manage
                </Button>
              )}
              <Button
                variant={joined ? "secondary" : "accent"}
                size="sm"
                className="gap-1.5"
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : joined ? (
                  <UserCheck className="size-3.5" strokeWidth={1.75} />
                ) : (
                  <UserPlus className="size-3.5" strokeWidth={1.75} />
                )}
                {joined ? "Joined" : "Join group"}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">{group.name}</h1>
              {group.is_featured && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/20">Featured</span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {group.is_public ? <Globe className="size-3" strokeWidth={1.75} /> : <Lock className="size-3" strokeWidth={1.75} />}
                {group.is_public ? "Public" : "Private"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <GroupCategoryBadges categories={parseGroupCategories(group)} />
              <span className="text-[12px] text-muted-foreground">
                {group.member_count.toLocaleString()} member{group.member_count !== 1 ? "s" : ""}
              </span>
            </div>
            {group.description && (
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{group.description}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Members */}
      <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">Members</p>
          <span className="text-[12px] text-muted-foreground">{group.member_count.toLocaleString()} total</span>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-surface py-10 text-center ring-1 ring-border">
            <Users className="mb-2 size-8 text-muted-foreground/30" strokeWidth={1.25} />
            <p className="text-[13px] text-muted-foreground">
              {joined ? "You're the first member!" : "No members yet. Be the first to join."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((m) => {
              const name = m.profiles?.full_name ?? m.profiles?.email?.split("@")[0] ?? "Member";
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-4 py-3 ring-1 ring-border"
                >
                  <Avatar name={name} src={m.profiles?.avatar_url ?? undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{name}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">{m.role}</p>
                  </div>
                  {m.role === "admin" && (
                    <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Admin</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.15 }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">Messages</p>
          <span className="text-[11px] text-muted-foreground">{joined ? "Realtime chat" : "Join to chat"}</span>
        </div>
        <GroupChatPanel groupId={groupId} joined={joined} />
      </motion.div>
    </div>
  );
}
