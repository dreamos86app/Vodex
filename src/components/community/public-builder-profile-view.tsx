"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Share2, Flag, UserPlus, UserMinus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserRankBadge } from "@/components/community/user-rank-badge";
import { toast } from "@/lib/toast";

type PublicProfile = {
  visibility?: "private" | "public";
  message?: string;
  id?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  rank: string;
  rankLabel: string;
  followerCount: number | null;
  profileVisitCount: number;
  profileVisits30d: number;
  joinedAt: string;
  allowFollows: boolean;
  following?: boolean;
  isOwner?: boolean;
  apps?: Array<{ id: string; name: string; previewUrl: string }>;
};

export function PublicBuilderProfileView({ username }: { username: string }) {
  const [profile, setProfile] = React.useState<PublicProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [followBusy, setFollowBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetch(`/api/community/profiles/${encodeURIComponent(username)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setProfile(j as PublicProfile);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  async function toggleFollow() {
    if (!profile || profile.isOwner) return;
    setFollowBusy(true);
    try {
      if (profile.following) {
        await fetch(`/api/community/follow?userId=${profile.id}`, { method: "DELETE", credentials: "include" });
        setProfile((p) =>
          p
            ? {
                ...p,
                following: false,
                followerCount:
                  p.followerCount != null ? Math.max(0, p.followerCount - 1) : p.followerCount,
              }
            : p,
        );
      } else {
        const res = await fetch("/api/community/follow", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profile.id }),
        });
        if (!res.ok) throw new Error("Follow failed");
        setProfile((p) =>
          p
            ? {
                ...p,
                following: true,
                followerCount: p.followerCount != null ? p.followerCount + 1 : p.followerCount,
              }
            : p,
        );
      }
    } catch {
      toast.error("Could not update follow status");
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!profile?.username) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <p className="text-[15px] font-medium text-foreground">Profile not found</p>
        <p className="mt-2 text-[13px] text-muted-foreground">This builder profile does not exist.</p>
        <Button variant="secondary" size="sm" className="mt-4" asChild>
          <Link href="/community">Back to Community</Link>
        </Button>
      </div>
    );
  }

  if (profile.visibility === "private") {
    return (
      <div className="mx-auto max-w-lg py-24 text-center px-4">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border">
          <Avatar src={profile.avatarUrl} name={profile.displayName} className="size-12 opacity-80" />
        </div>
        <p className="text-[17px] font-semibold text-foreground">{profile.displayName}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">@{profile.username}</p>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
          {profile.message ?? "This builder keeps their profile private."}
        </p>
        {profile.isOwner ? (
          <Button variant="accent" size="sm" className="mt-6" asChild>
            <Link href="/settings">Open profile settings</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="mt-6" asChild>
            <Link href="/community">Back to Community</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[var(--radius-xl)] bg-gradient-to-br from-surface via-background to-blue-500/5 p-6 ring-1 ring-border"
      >
        <div className="flex flex-wrap items-start gap-4">
          <Avatar src={profile.avatarUrl} name={profile.displayName} className="size-16" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold text-foreground">{profile.displayName}</h1>
              <UserRankBadge rankId={profile.rank} />
            </div>
            <p className="text-[13px] text-muted-foreground">@{profile.username}</p>
            {profile.bio ? <p className="mt-3 text-[14px] leading-relaxed text-foreground/90">{profile.bio}</p> : null}
            <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
              {profile.followerCount != null ? (
                <span>{profile.followerCount.toLocaleString()} followers</span>
              ) : null}
              <span>{profile.profileVisitCount.toLocaleString()} visits lifetime</span>
              <span>{profile.profileVisits30d.toLocaleString()} visits (30d)</span>
              <span>Joined {new Date(profile.joinedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {!profile.isOwner && profile.allowFollows ? (
              <Button
                variant={profile.following ? "secondary" : "accent"}
                size="sm"
                className="gap-1.5"
                disabled={followBusy}
                onClick={() => void toggleFollow()}
              >
                {profile.following ? <UserMinus className="size-3.5" /> : <UserPlus className="size-3.5" />}
                {profile.following ? "Unfollow" : "Follow"}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                toast.success("Profile link copied");
              }}
            >
              <Share2 className="size-3.5" /> Share
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Flag className="size-3.5" /> Report
            </Button>
          </div>
        </div>
      </motion.div>

      {(profile.apps?.length ?? 0) > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold text-foreground">Published apps</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(profile.apps ?? []).map((app) => (
              <div key={app.id} className="overflow-hidden rounded-xl ring-1 ring-border">
                <iframe
                  title={`${app.name} preview`}
                  src={app.previewUrl}
                  className="h-44 w-full border-0 bg-muted/20"
                  sandbox="allow-scripts allow-same-origin"
                />
                <div className="border-t border-border px-3 py-2">
                  <p className="text-[13px] font-medium text-foreground">{app.name}</p>
                  <p className="text-[11px] text-muted-foreground">View-only preview inside Vodex</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
