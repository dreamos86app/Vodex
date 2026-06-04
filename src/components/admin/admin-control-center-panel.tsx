"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AdminInboxMessagesPanel } from "@/components/admin/admin-inbox-messages-panel";
import { AdminAnnouncementsPanel } from "@/components/admin/admin-announcements-panel";
import { AdminEmailMarketingPanel } from "@/components/admin/admin-email-marketing-panel";
import { AdminSystemStatusPanel } from "@/components/admin/admin-system-status-panel";
import { AdminPreviewRuntimePanel } from "@/components/admin/admin-preview-runtime-panel";

type Tab = "inbox" | "announcements" | "email" | "status" | "preview";

const TABS: { id: Tab; label: string }[] = [
  { id: "inbox", label: "User inbox" },
  { id: "announcements", label: "Top-bar alerts" },
  { id: "email", label: "Email marketing" },
  { id: "status", label: "Status page" },
  { id: "preview", label: "Preview runtime" },
];

export function AdminControlCenterPanel() {
  const [tab, setTab] = React.useState<Tab>("inbox");

  return (
    <div className="space-y-6" data-testid="admin-control-center">
      <div>
        <h2 className="text-[16px] font-semibold">Control Center</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Three communication systems: in-app inbox messages, top-bar announcements, and Resend email
          marketing — plus public status page controls.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/40 p-1 ring-1 ring-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold transition",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "inbox" ? <AdminInboxMessagesPanel /> : null}
      {tab === "announcements" ? <AdminAnnouncementsPanel /> : null}
      {tab === "email" ? <AdminEmailMarketingPanel /> : null}
      {tab === "status" ? <AdminSystemStatusPanel /> : null}
      {tab === "preview" ? <AdminPreviewRuntimePanel /> : null}
    </div>
  );
}
