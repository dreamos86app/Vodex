"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Loader2, Lock, Globe, UserPlus, UserCheck, Settings, X, Share2, Flag,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { ReportDialog } from "@/components/community/report-dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { GroupChatPanel } from "@/components/community/group-chat-panel";
import { GroupCategoryBadges, parseGroupCategories } from "@/components/community/group-category-badges";
import { ConfirmDialog } from "@/components/community/confirm-dialog";
import { profileDisplayName } from "@/lib/community/profile-display-name";
import { normalizeGroupCategories } from "@/lib/community/group-categories";
import { GroupCategoryPicker } from "@/components/community/group-category-picker";

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
  rules?: string[] | null;
}

interface GroupMember {
  user_id: string;
  role: string;
  joined_at: string;
  profiles?: { id: string; full_name: string | null; email: string; avatar_url: string | null; username?: string | null };
  presence?: string;
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
  const [showMembers, setShowMembers] = React.useState(false);
  const [showManage, setShowManage] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [manageName, setManageName] = React.useState("");
  const [manageDesc, setManageDesc] = React.useState("");
  const [manageCategories, setManageCategories] = React.useState<string[]>(["General"]);
  const [manageRules, setManageRules] = React.useState<string[]>([]);
  const [savingManage, setSavingManage] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [manageBanner, setManageBanner] = React.useState("#4f7cff");
  const [manageIconUrl, setManageIconUrl] = React.useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = React.useState(false);

  const load = React.useCallback(async () => {
    const [{ data: grp, error: grpErr }, { data: mems }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("user_id, role, joined_at").eq("group_id", groupId).order("joined_at", { ascending: true }),
    ]);

    if (grpErr || !grp) {
      setError(grpErr?.message ?? "Group not found.");
      setLoading(false);
      return;
    }

    const groupRow = grp as unknown as Group;
    setGroup(groupRow);
    setManageName(groupRow.name);
    setManageDesc(groupRow.description ?? "");
    setManageCategories(parseGroupCategories(groupRow));
    const rawRules = groupRow.rules;
    setManageRules(Array.isArray(rawRules) ? rawRules.filter((r): r is string => typeof r === "string") : []);
    setManageBanner(groupRow.banner_color);
    setManageIconUrl(groupRow.icon_url);

    const memberRows = (mems ?? []) as GroupMember[];
    const userIds = memberRows.map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, email, avatar_url, username").in("id", userIds)
      : { data: [] as GroupMember["profiles"][] };

    const profileMap = new Map(
      (profiles ?? []).filter((p): p is NonNullable<typeof p> => Boolean(p?.id)).map((p) => [p.id, p]),
    );
    let presenceMap = new Map<string, string>();
    if (userIds.length) {
      try {
        const pr = await fetch("/api/user/presence/batch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds }),
        });
        const pj = (await pr.json()) as { statuses?: Record<string, string> };
        presenceMap = new Map(Object.entries(pj.statuses ?? {}).map(([id, status]) => [id, status ?? "offline"]));
      } catch { /* optional */ }
    }

    const enriched = memberRows.map((m) => ({
      ...m,
      profiles: profileMap.get(m.user_id) ?? undefined,
      presence: presenceMap.get(m.user_id) ?? "offline",
    }));
    setMembers(enriched);
    setJoined(user ? enriched.some((m) => m.user_id === user.id) : false);
    setLoading(false);
  }, [groupId, supabase, user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [groupId]);

  async function handleJoin() {
    if (!user) { router.push("/auth/login"); return; }
    setJoining(true);
    if (joined) {
      setLeaveOpen(true);
      setJoining(false);
      return;
    }
    await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
    setJoined(true);
    setGroup((g) => g ? { ...g, member_count: g.member_count + 1 } : g);
    void load();
    setJoining(false);
  }

  async function confirmLeave() {
    if (!user) return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    setJoined(false);
    setGroup((g) => g ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g);
    setLeaveOpen(false);
    void load();
  }

  async function saveManage() {
    if (!group || group.creator_id !== user?.id) return;
    setSavingManage(true);
    const categories = normalizeGroupCategories(manageCategories);
    const { error: err } = await (supabase as any)
      .from("groups")
      .update({
        name: manageName.trim(),
        description: manageDesc.trim() || null,
        categories,
        category: categories[0],
        rules: manageRules.filter((r) => r.trim()),
        banner_color: manageBanner,
        icon_url: manageIconUrl,
      })
      .eq("id", groupId);
    setSavingManage(false);
    if (err) return;
    setShowManage(false);
    void load();
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
      <Link href="/community" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        Community
      </Link>

      <motion.div variants={variants.fadeUp} initial="hidden" animate="show" className="overflow-hidden rounded-[var(--radius-2xl)] bg-surface ring-1 ring-border">
        <div className="h-32 w-full sm:h-40" style={{ background: group.banner_color }} />
        <div className="relative px-5 pb-5 sm:px-6">
          <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-4">
            <div
              className="flex size-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-accent sm:size-20"
              style={{ background: group.icon_url ? undefined : "rgba(79,124,255,0.12)" }}
            >
              {group.icon_url ? (
                <img src={group.icon_url} alt={group.name} className="size-full object-cover" />
              ) : (
                <Users className="size-8 text-accent/70" strokeWidth={1.5} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  void navigator.clipboard.writeText(window.location.href);
                  toast.success("Group link copied");
                }}
              >
                <Share2 className="size-3.5" /> Share
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setReportOpen(true)}>
                <Flag className="size-3.5" /> Report
              </Button>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setShowMembers(true)}>
                <Users className="size-3.5" /> Members
              </Button>
              {isCreator ? (
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setShowManage(true)}>
                  <Settings className="size-3.5" /> Manage
                </Button>
              ) : null}
              {!isCreator ? (
                <Button variant={joined ? "secondary" : "accent"} size="sm" className="gap-1.5" onClick={handleJoin} disabled={joining}>
                  {joining ? <Loader2 className="size-3.5 animate-spin" /> : joined ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                  {joined ? "Leave group" : "Join group"}
                </Button>
              ) : null}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">{group.name}</h1>
              {group.is_featured ? <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/20">Featured</span> : null}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {group.is_public ? <Globe className="size-3" /> : <Lock className="size-3" />}
                {group.is_public ? "Public" : "Private"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <GroupCategoryBadges categories={parseGroupCategories(group)} />
              <span className="text-[12px] text-muted-foreground">{members.length || group.member_count} members</span>
            </div>
            {group.description ? <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{group.description}</p> : null}
            {group.rules && group.rules.length > 0 ? (
              <div className="mt-4 rounded-xl bg-muted/30 px-4 py-3 ring-1 ring-border/60">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Group rules</p>
                <ol className="mt-2 space-y-1.5 list-decimal pl-4 text-[12.5px] text-foreground/90">
                  {group.rules.map((rule, i) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>

      <motion.div variants={variants.fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
        <GroupChatPanel groupId={groupId} joined={joined || isCreator} />
      </motion.div>

      <ConfirmDialog
        open={leaveOpen}
        title="Leave this group?"
        description="You can rejoin anytime from the Community groups tab."
        confirmLabel="Leave group"
        destructive
        onConfirm={() => void confirmLeave()}
        onCancel={() => setLeaveOpen(false)}
      />

      <AnimatePresence>
        {showMembers ? (
          <MembersDrawer
            members={members}
            groupId={groupId}
            creatorId={group.creator_id}
            currentUserId={user?.id}
            onClose={() => setShowMembers(false)}
            onChanged={() => void load()}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showManage && isCreator ? (
          <ManageSheet
            name={manageName}
            description={manageDesc}
            categories={manageCategories}
            rules={manageRules}
            bannerColor={manageBanner}
            iconUrl={manageIconUrl}
            uploadingIcon={uploadingIcon}
            saving={savingManage}
            onName={setManageName}
            onDescription={setManageDesc}
            onCategories={setManageCategories}
            onRules={setManageRules}
            onBannerColor={setManageBanner}
            onIconUpload={async (file) => {
              setUploadingIcon(true);
              try {
                const fd = new FormData();
                fd.append("file", file);
                const res = await fetch("/api/upload/group-icon", { method: "POST", body: fd });
                const j = (await res.json()) as { url?: string; error?: string };
                if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed");
                setManageIconUrl(j.url);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not upload icon");
              } finally {
                setUploadingIcon(false);
              }
            }}
            onSave={() => void saveManage()}
            onClose={() => setShowManage(false)}
          />
        ) : null}
      </AnimatePresence>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="group"
        targetId={groupId}
        targetLabel={group.name}
      />
    </div>
  );
}

function presenceColor(status: string) {
  if (status === "online") return "bg-emerald-500";
  if (status === "away") return "bg-amber-400";
  return "bg-muted-foreground/40";
}

function MembersDrawer({
  members,
  groupId,
  creatorId,
  currentUserId,
  onClose,
  onChanged,
}: {
  members: GroupMember[];
  groupId: string;
  creatorId: string | null;
  currentUserId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canModerate = Boolean(currentUserId && creatorId === currentUserId);

  async function kickMember(userId: string) {
    const res = await fetch(`/api/community/groups/${groupId}/members/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return;
    onChanged();
  }

  async function banMember(userId: string) {
    const res = await fetch(`/api/community/groups/${groupId}/sanctions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, sanctionType: "ban", reason: "Removed by moderator" }),
    });
    if (!res.ok) return;
    onChanged();
  }

  async function transferOwnership(userId: string) {
    const res = await fetch(`/api/community/groups/${groupId}/transfer`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return;
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-[1500] flex justify-end">
      <button type="button" className="absolute inset-0 bg-foreground/30" onClick={onClose} aria-label="Close" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">Members ({members.length})</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X className="size-4" /></button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
          {members.map((m) => {
            const name = profileDisplayName(m.profiles ?? null);
            const profileHref = m.profiles?.username ? `/builders/${m.profiles.username}` : null;
            const isSelf = m.user_id === currentUserId;
            const isOwner = m.user_id === creatorId;
            return (
              <li key={m.user_id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-border">
                <div className="relative">
                  <Avatar name={name} src={m.profiles?.avatar_url ?? undefined} size="sm" />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background", presenceColor(m.presence ?? "offline"))} />
                </div>
                <div className="min-w-0 flex-1">
                  {profileHref ? (
                    <Link href={profileHref} className="truncate text-[13px] font-medium hover:text-accent">
                      {name}
                    </Link>
                  ) : (
                    <p className="truncate text-[13px] font-medium">{name}</p>
                  )}
                  <p className="text-[11px] capitalize text-muted-foreground">{m.role}{isOwner ? " · Owner" : ""}</p>
                </div>
                {canModerate && !isSelf && !isOwner ? (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => void kickMember(m.user_id)} className="rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">Kick</button>
                    <button type="button" onClick={() => void banMember(m.user_id)} className="rounded-lg px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10">Ban</button>
                    <button type="button" onClick={() => void transferOwnership(m.user_id)} className="rounded-lg px-2 py-1 text-[10px] text-accent hover:bg-accent/10">Make owner</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}

function ManageSheet({
  name, description, categories, rules, bannerColor, iconUrl, uploadingIcon, saving,
  onName, onDescription, onCategories, onRules, onBannerColor, onIconUpload, onSave, onClose,
}: {
  name: string;
  description: string;
  categories: string[];
  rules: string[];
  bannerColor: string;
  iconUrl: string | null;
  uploadingIcon: boolean;
  saving: boolean;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  onCategories: (v: string[]) => void;
  onRules: (v: string[]) => void;
  onBannerColor: (v: string) => void;
  onIconUpload: (file: File) => Promise<void>;
  onSave: () => void;
  onClose: () => void;
}) {
  const iconInputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-foreground/30" onClick={onClose} aria-label="Close" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-5 shadow-2xl ring-1 ring-border">
        <p className="text-[15px] font-semibold">Manage group</p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[12px] font-medium">Banner color</p>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={bannerColor} onChange={(e) => onBannerColor(e.target.value)} className="size-10 cursor-pointer rounded-lg border border-border bg-transparent" />
              <input value={bannerColor} onChange={(e) => onBannerColor(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg bg-surface px-3 text-[13px] ring-1 ring-border" />
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium">Group icon</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border" style={{ background: iconUrl ? undefined : `${bannerColor}33` }}>
                {iconUrl ? <img src={iconUrl} alt="" className="size-full object-cover" /> : <Users className="size-5 text-accent" />}
              </div>
              <input ref={iconInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onIconUpload(f); }} />
              <Button variant="secondary" size="sm" disabled={uploadingIcon} onClick={() => iconInputRef.current?.click()}>
                {uploadingIcon ? "Uploading…" : iconUrl ? "Change icon" : "Upload icon"}
              </Button>
            </div>
          </div>
          <label className="block text-[12px] font-medium">Name<input value={name} onChange={(e) => onName(e.target.value)} className="mt-1 h-10 w-full rounded-lg bg-surface px-3 text-[13px] ring-1 ring-border" /></label>
          <label className="block text-[12px] font-medium">Description<textarea value={description} onChange={(e) => onDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg bg-surface px-3 py-2 text-[13px] ring-1 ring-border" /></label>
          <div><p className="text-[12px] font-medium mb-2">Categories</p><GroupCategoryPicker value={categories} onChange={onCategories} /></div>
          <div>
            <p className="text-[12px] font-medium mb-2">Rules</p>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <span className="pt-2 text-[12px] font-semibold text-muted-foreground">{i + 1}.</span>
                  <input value={rule} onChange={(e) => onRules(rules.map((r, j) => (j === i ? e.target.value : r)))} className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-[13px] ring-1 ring-border" placeholder="Rule text" />
                  <button type="button" onClick={() => onRules(rules.filter((_, j) => j !== i))} className="text-[11px] text-destructive">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => onRules([...rules, ""])} className="text-[12px] font-medium text-accent">+ Add rule</button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </motion.div>
    </div>
  );
}
