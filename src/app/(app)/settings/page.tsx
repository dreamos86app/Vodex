"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  SectionCard,
  SettingRow,
  FieldLabel,
  selectCls,
  textareaCls,
} from "@/components/settings/shared";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, ImagePlus, Trash2, AlertTriangle, Loader2, Zap, Sparkles } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { resolveClientUserId } from "@/lib/chat/resolve-client-user";
import {
  hasActiveSession,
  isStalePersistedProfile,
  resolveAccountEmail,
} from "@/lib/auth/client-identity";
import { useCreditsStore, getMonthlyTokenQuotaForPlan } from "@/lib/stores/credits-store";
import { DreamSpaceGlyph, resolveDreamSpaceLabel } from "@/lib/dream-space";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsGeneralPage() {
  const router = useRouter();
  const { profile, user, session, loading: authLoading, setProfile } = useAuthStore();
  const { remaining } = useCreditsStore();
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const sessionReady = hydrated && !authLoading;
  const signedIn = hasActiveSession(session, user);
  const staleProfile = isStalePersistedProfile(session, profile);
  const accountEmail = resolveAccountEmail(user, profile);

  async function requireUserId(): Promise<string | null> {
    if (!signedIn) return null;
    const supabase = createClient();
    return resolveClientUserId(supabase, user, profile);
  }

  const [sidebarStyle, setSidebarStyle] = React.useState(true);
  const [fontSize, setFontSize] = React.useState("15");
  const [workspaceName, setWorkspaceName] = React.useState("My Workspace");
  const [description, setDescription] = React.useState("");
  const [workspaceIconUrl, setWorkspaceIconUrl] = React.useState<string | null>(null);
  const [showBranding, setShowBranding] = React.useState(true);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deleteInput, setDeleteInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [uploadingIcon, setUploadingIcon] = React.useState(false);
  const iconInputRef = React.useRef<HTMLInputElement>(null);

  const isPaidPlan = profile && profile.plan_id !== "free";
  const dreamLabelResolved = resolveDreamSpaceLabel(profile, user);
  const tokenQuota = getMonthlyTokenQuotaForPlan(profile?.plan_id);
  const planBadge =
    profile &&
    (profile.plan_id === "free"
      ? "Free"
      : profile.plan_id.charAt(0).toUpperCase() + profile.plan_id.slice(1));

  // Sync workspace fields from profile whenever the profile ID changes
  React.useEffect(() => {
    if (!signedIn || !accountEmail || profile?.email?.trim()) return;
    void fetch("/api/profile/ensure", { method: "POST", credentials: "include" }).then(async (res) => {
      if (!res.ok) return;
      const payload = (await res.json()) as { profile?: typeof profile };
      if (payload.profile) setProfile(payload.profile);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- backfill once when email missing
  }, [signedIn, accountEmail, profile?.id]);

  const profileId = profile?.id;
  React.useEffect(() => {
    if (!profile) return;
    /* eslint-disable react-hooks/set-state-in-effect -- sync form from server profile */
    setWorkspaceName(profile.workspace_name ?? "My Workspace");
    setDescription(profile.workspace_description ?? "");
    setWorkspaceIconUrl(profile.workspace_icon_url ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const baselineName = profile?.workspace_name ?? "My Workspace";
  const baselineDesc = profile?.workspace_description ?? "";
  const baselineIcon = profile?.workspace_icon_url ?? null;

  const workspaceDirty =
    workspaceName.trim() !== baselineName.trim() ||
    description.trim() !== baselineDesc.trim() ||
    (workspaceIconUrl ?? null) !== (baselineIcon ?? null);

  const themeOptions: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="size-4" strokeWidth={1.6} /> },
    { value: "dark", label: "Dark", icon: <Moon className="size-4" strokeWidth={1.6} /> },
    { value: "system", label: "System", icon: <Monitor className="size-4" strokeWidth={1.6} /> },
  ];

  const activeTheme = hydrated ? (theme ?? "system") : "system";

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const uid = await requireUserId();
    if (!uid) {
      toast.error(
        staleProfile
          ? "Session expired — sign in again to upload a workspace icon."
          : "Sign in to upload a workspace icon.",
      );
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/workspace-icon", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string; hint?: string };
        const detail = err.hint ? `${err.error ?? "Upload failed"} — ${err.hint}` : (err.error ?? "Upload failed");
        throw new Error(detail);
      }
      const { publicUrl, profile: updated } = (await res.json()) as {
        publicUrl: string;
        profile?: typeof profile;
      };
      const iconWithBust = updated?.workspace_icon_url ?? `${publicUrl}?t=${Date.now()}`;
      setWorkspaceIconUrl(iconWithBust);

      if (updated) {
        setProfile(updated);
        toast.success("Dream Space icon saved");
        router.refresh();
        return;
      }

      throw new Error("Upload succeeded but profile was not returned");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to upload icon: ${msg}`);
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = "";
    }
  }

  async function handleSaveWorkspace() {
    const uid = await requireUserId();
    if (!uid) {
      toast.error(
        staleProfile
          ? "Session expired — sign in again to save workspace settings."
          : "Sign in to save workspace settings.",
      );
      return;
    }
    setSaving(true);
    try {
      const iconBase =
        workspaceIconUrl && workspaceIconUrl.length > 0
          ? workspaceIconUrl.split("?")[0] || workspaceIconUrl
          : null;

      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_name: workspaceName.trim(),
          workspace_description: description.trim(),
          workspace_icon_url: iconBase,
        }),
      });
      const payload = (await res.json()) as { error?: string; profile?: typeof profile };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to save");
      }
      if (payload.profile) {
        setProfile(payload.profile);
        if (payload.profile.workspace_icon_url) {
          setWorkspaceIconUrl(payload.profile.workspace_icon_url);
        }
        toast.success("Dream Space saved");
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div className="space-y-6">
      {sessionReady && staleProfile ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-900 dark:text-amber-200"
        >
          Your session expired.{" "}
          <Link href="/auth/login" className="font-semibold underline underline-offset-2">
            Sign in again
          </Link>{" "}
          to sync your profile and Dream Space.
        </motion.div>
      ) : null}
      {/* Dream Space — primary identity */}
      <div className="overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-accent/[0.09] via-background to-violet-500/[0.06] p-px shadow-[var(--shadow-card)] ring-1 ring-border/80">
        <div className="rounded-[calc(var(--radius-xl)-1px)] bg-background/95 px-4 py-5 backdrop-blur-sm sm:px-5 sm:py-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="size-3" strokeWidth={1.75} />
            Dream Space
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start lg:flex-col lg:items-center">
              <div
                className="relative isolate overflow-hidden rounded-full p-1"
                style={{
                  background:
                    "repeating-conic-gradient(hsl(var(--muted-foreground) / 0.14) 0% 25%, hsl(var(--muted) / 0.35) 0% 50%) 50% / 14px 14px",
                }}
              >
                <div className="rounded-full bg-background p-1 shadow-inner ring-1 ring-border/60">
                  <div className="relative size-24 sm:size-28">
                    <DreamSpaceGlyph
                      iconUrl={workspaceIconUrl}
                      label={workspaceName || dreamLabelResolved}
                      sizeClass="size-full rounded-full"
                      textClassName="text-xl sm:text-2xl"
                      className="rounded-full ring-1 ring-border/80"
                    />
                    {uploadingIcon && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
                        <Loader2 className="size-7 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col items-center gap-2 sm:items-start lg:items-center">
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleIconChange}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => iconInputRef.current?.click()}
                  disabled={uploadingIcon}
                >
                  {uploadingIcon ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-3.5" strokeWidth={1.6} />
                  )}
                  {uploadingIcon ? "Uploading…" : "Change icon"}
                </Button>
                <p className="max-w-[200px] text-center text-[11px] text-muted-foreground sm:text-left lg:text-center">
                  PNG, JPG, or WebP · max 5MB · transparency kept
                </p>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {planBadge && (
                  <span className="inline-flex rounded-full bg-accent/12 px-2.5 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20">
                    {planBadge} plan
                  </span>
                )}
                <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border/60">
                  <Zap className="size-3 shrink-0 text-accent" strokeWidth={1.75} />
                  <span className="tabular-nums font-medium text-foreground">{remaining.toLocaleString()}</span>
                  <span className="text-muted-foreground/70">/</span>
                  <span className="tabular-nums">{tokenQuota.toLocaleString()}</span>
                  <span className="ml-0.5">tokens this period</span>
                </div>
              </div>

              <label className="block">
                <FieldLabel>Name</FieldLabel>
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Dream Space"
                />
              </label>

              <label className="block">
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What you build here — shown in the shell and create workspace."
                  className={textareaCls}
                />
              </label>

              <div className="rounded-[var(--radius-md)] bg-muted/35 px-3 py-2 ring-1 ring-border/60">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Owner (account email)
                </p>
                <p className="truncate text-[13px] font-medium text-foreground">
                  {accountEmail || (sessionReady && !signedIn ? "Sign in to view email" : "—")}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  This is your DreamOS86 login. Space name above is only a display label.
                </p>
              </div>

              <p className="text-[12px] text-muted-foreground">
                <Link
                  href="/settings/account"
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  Account security
                </Link>
                {" · "}
                email, password, and sign-in for your DreamOS86 user.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setWorkspaceName(profile?.workspace_name ?? "My Workspace");
                setDescription(profile?.workspace_description ?? "");
                setWorkspaceIconUrl(profile?.workspace_icon_url ?? null);
              }}
            >
              Discard
            </Button>
            <Button
              variant="accent"
              size="md"
              onClick={handleSaveWorkspace}
              disabled={saving || !workspaceDirty || !signedIn}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <SectionCard title="Appearance" description="Customize how DreamOS86 looks and feels.">
        <div className="space-y-6">
          <div>
            <FieldLabel>Theme</FieldLabel>
            <div className="flex gap-2">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!hydrated}
                  onClick={() => {
                    setTheme(opt.value);
                    toast.success(`Theme set to ${opt.label}`);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] font-medium ring-1 transition-all duration-150 disabled:opacity-50",
                    activeTheme === opt.value
                      ? "bg-foreground/[0.07] ring-border-strong text-foreground"
                      : "bg-surface ring-border text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Font Size</FieldLabel>
              <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className={selectCls}>
                <option value="13">Small (13px)</option>
                <option value="14">Normal (14px)</option>
                <option value="15">Medium (15px)</option>
                <option value="16">Large (16px)</option>
              </select>
            </div>
          </div>

          <SettingRow title="Compact sidebar" description="Show icons only in the sidebar to maximize workspace area.">
            <Switch checked={sidebarStyle} onCheckedChange={setSidebarStyle} aria-label="Compact sidebar" />
          </SettingRow>
        </div>
      </SectionCard>

      {/* App Branding */}
      <SectionCard title="App Branding" description="Control how DreamOS86 branding appears on your generated apps.">
        <div className="space-y-1">
          <SettingRow
            title='Show "Built with DreamOS86"'
            description={
              isPaidPlan
                ? "Display a small DreamOS86 badge on your published apps. Uncheck to remove."
                : "Free plan includes the DreamOS86 watermark. Upgrade to Starter or higher to remove it."
            }
          >
            <Switch
              checked={isPaidPlan ? showBranding : true}
              onCheckedChange={isPaidPlan ? setShowBranding : undefined}
              disabled={!isPaidPlan}
              aria-label="Show DreamOS86 branding"
            />
          </SettingRow>
          {!isPaidPlan && (
            <p className="pl-1 text-[11.5px] text-muted-foreground">
              <a href="/pricing" className="text-accent hover:underline underline-offset-2">Upgrade to Starter</a>{" "}
              to remove the watermark from your apps.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard title="Danger Zone" description="Irreversible actions that affect your entire workspace." danger>
        {!deleteConfirm ? (
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-foreground">Delete workspace</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Permanently delete this workspace, all projects, and data. This cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              size="md"
              className="shrink-0 text-red-600 dark:text-red-400 ring-red-200/70 dark:ring-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="size-3.5" strokeWidth={1.6} />
              Delete workspace
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-red-100/60 dark:bg-red-950/30 px-4 py-3 ring-1 ring-red-200/60 dark:ring-red-800/40">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" strokeWidth={1.6} />
              <p className="text-[13px] text-red-700 dark:text-red-300">
                Type <strong>delete workspace</strong> below to confirm.
              </p>
            </div>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder='Type "delete workspace" to confirm'
              className="ring-red-200/70 dark:ring-red-800/40 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="md" onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="md"
                disabled={deleteInput !== "delete workspace"}
                className="text-red-600 dark:text-red-400 ring-red-200/70 dark:ring-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
              >
                Permanently delete
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
