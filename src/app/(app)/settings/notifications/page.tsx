"use client";

import * as React from "react";
import { Volume2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/settings/shared";
import { toast } from "@/lib/toast";
import { setCachedNotificationPrefs } from "@/lib/notifications/notification-prefs-cache";
import { defaultNotificationPrefs, normalizeNotificationPrefs } from "@/lib/notifications/notification-preferences";

export default function NotificationsSettingsPage() {
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [marketingOptIn, setMarketingOptIn] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void fetch("/api/notification-preferences", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { prefs?: { soundEnabled?: boolean }; marketingOptIn?: boolean } | null) => {
        if (json?.prefs && typeof json.prefs.soundEnabled === "boolean") {
          setSoundEnabled(json.prefs.soundEnabled);
        }
        if (typeof json?.marketingOptIn === "boolean") setMarketingOptIn(json.marketingOptIn);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    try {
      const base = defaultNotificationPrefs();
      base.soundEnabled = soundEnabled;
      const payload = {
        soundEnabled,
        categories: base.categories,
      };
      setCachedNotificationPrefs(normalizeNotificationPrefs(payload));
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prefs: payload, marketingOptIn }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Preferences saved");
    } catch {
      toast.error("Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="In-app notification sounds"
        description="Inbox notifications always appear in the bell. These settings only control whether a sound plays when a new notification arrives."
      >
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
              <Volume2 className="size-5 text-accent" strokeWidth={1.65} />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">Play notification sound</p>
              <p className="text-[12px] text-muted-foreground">Short chime when you receive a new inbox message</p>
            </div>
          </div>
          <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} aria-label="Notification sounds" />
        </div>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="accent" size="md" disabled={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Product emails (optional)"
        description="Marketing and product update emails via Resend. Transactional emails (password reset, invites) may still be sent when required."
      >
        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <p className="text-[13px] font-medium text-foreground">Email me product updates</p>
            <p className="text-[12px] text-muted-foreground">Tips, features, and offers — you can unsubscribe anytime</p>
          </div>
          <Switch checked={marketingOptIn} onCheckedChange={setMarketingOptIn} aria-label="Marketing emails" />
        </div>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="accent" size="md" disabled={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
