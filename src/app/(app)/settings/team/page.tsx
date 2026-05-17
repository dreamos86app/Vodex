"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard, selectCls } from "@/components/settings/shared";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  Crown,
  ShieldCheck,
  User,
  Trash2,
  Mail,
  Clock,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { toast } from "@/lib/toast";

type RoleKey = "owner" | "admin" | "member";

const roleInfo: Record<
  RoleKey,
  {
    icon: React.ElementType;
    label: string;
    description: string;
    badge: "neutral" | "accent" | "positive" | "warning";
  }
> = {
  owner: {
    icon: Crown,
    label: "Owner",
    description: "Full control — billing, deletion, all settings.",
    badge: "warning",
  },
  admin: {
    icon: ShieldCheck,
    label: "Admin",
    description: "Manage members, projects, and integrations.",
    badge: "accent",
  },
  member: {
    icon: User,
    label: "Member",
    description: "Create and edit projects, view billing.",
    badge: "neutral",
  },
};

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  sentAt: string;
}

export default function TeamSettingsPage() {
  const { profile } = useAuthStore();
  const hydrated = useHydrated();
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("member");
  const [invites, setInvites] = React.useState<PendingInvite[]>([]);
  const [inviteSent, setInviteSent] = React.useState(false);

  const displayName = profile?.full_name ?? profile?.email?.split("@")[0] ?? "You";
  const displayEmail = profile?.email ?? "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleInvite = () => {
    if (!inviteEmail.includes("@")) return;
    setInvites((prev) => [
      ...prev,
      {
        id: `pi${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        sentAt: "Just now",
      },
    ]);
    setInviteEmail("");
    setInviteSent(true);
    toast.success(`Invitation sent to ${inviteEmail}`);
    setTimeout(() => setInviteSent(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Invite */}
      <SectionCard
        title="Invite Team Member"
        description="Invite collaborators to your workspace by email."
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className={cn(selectCls, "sm:w-36")}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            variant="accent"
            size="md"
            onClick={handleInvite}
            disabled={!inviteEmail.includes("@")}
            className="gap-1.5"
          >
            <UserPlus className="size-3.5" strokeWidth={1.6} />
            {inviteSent ? "Sent!" : "Send invite"}
          </Button>
        </div>
      </SectionCard>

      {/* Current members — only real user */}
      <SectionCard
        title="Team Members"
        description="1 member in this workspace."
        noPadding
      >
        <div className="divide-y divide-border">
          {hydrated && profile ? (
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 text-[13px] font-bold text-white shadow-[var(--shadow-xs)]">
                {initials || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {displayName}
                  <span className="ml-2 text-[11px] text-muted-foreground font-normal">(you)</span>
                </p>
                <p className="text-[12px] text-muted-foreground truncate">{displayEmail}</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <Crown className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
                <Badge variant="warning">Owner</Badge>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="size-10 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Empty state for additional members */}
        <div className="px-6 py-8 text-center border-t border-border">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border mx-auto mb-3">
            <Users className="size-4.5 text-muted-foreground/60" strokeWidth={1.4} />
          </div>
          <p className="text-[13px] font-medium text-foreground">No teammates yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Invite collaborators above to start building together.
          </p>
        </div>
      </SectionCard>

      {/* Pending invites */}
      {invites.length > 0 && (
        <SectionCard
          title="Pending Invites"
          description="These people have been invited but haven't joined yet."
          noPadding
        >
          <div className="divide-y divide-border">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors duration-100"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border">
                  <Mail className="size-4 text-muted-foreground" strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {invite.email}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="size-3 text-muted-foreground" strokeWidth={1.6} />
                    <span className="text-[12px] text-muted-foreground">
                      Invited {invite.sentAt}
                    </span>
                  </div>
                </div>
                <Badge variant="neutral" className="shrink-0 capitalize">
                  {invite.role}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
                    toast.info("Invite revoked");
                  }}
                  className="text-muted-foreground hover:text-red-500 shrink-0"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.6} />
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Role descriptions */}
      <SectionCard
        title="Role Permissions"
        description="Understand what each role can do."
        noPadding
      >
        <div className="divide-y divide-border">
          {(Object.entries(roleInfo) as [RoleKey, (typeof roleInfo)[RoleKey]][]).map(
            ([key, role]) => {
              const Icon = role.icon;
              return (
                <div key={key} className="flex items-start gap-4 px-6 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted ring-1 ring-border mt-0.5">
                    <Icon className="size-4 text-muted-foreground" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground">{role.label}</p>
                      <Badge variant={role.badge}>{role.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </SectionCard>
    </div>
  );
}
