"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_NAV,
  readStoredDashboardSection,
  storeDashboardSection,
  type DashboardNavItem,
} from "@/lib/dashboard/dashboard-nav";
import {
  getDashboardSectionAccess,
  type DashboardSectionAccess,
  type DashboardSectionId,
} from "@/lib/dashboard/section-access";

export type DashboardPanelSection = DashboardSectionId | "auth" | "template";

type Props = {
  projectId: string;
  section: DashboardPanelSection;
  onSectionChange: (section: DashboardPanelSection) => void;
  project: Parameters<typeof getDashboardSectionAccess>[0];
  planId?: string | null;
};

function accessFor(
  project: Props["project"],
  id: DashboardNavItem["id"],
  planId?: string | null,
): DashboardSectionAccess {
  if (id === "auth" || id === "template") {
    return getDashboardSectionAccess(project, "settings", planId);
  }
  return getDashboardSectionAccess(project, id as DashboardSectionId, planId);
}

export function DashboardSectionNav({ projectId, section, onSectionChange, project, planId }: Props) {
  const mobileScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const stored = readStoredDashboardSection(projectId);
    if (stored && DASHBOARD_NAV.some((n) => n.id === stored) && stored !== section) {
      onSectionChange(stored as DashboardPanelSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per project
  }, [projectId]);

  React.useEffect(() => {
    const el = mobileScrollRef.current?.querySelector(`[data-dashboard-section="${section}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [section]);

  const pick = (id: DashboardPanelSection) => {
    storeDashboardSection(projectId, id);
    onSectionChange(id);
  };

  const NavButton = ({ item, mobile }: { item: DashboardNavItem; mobile?: boolean }) => {
    const access = accessFor(project, item.id, planId);
    const locked = access !== "unlocked" && item.id !== "overview";
    const active = section === item.id;
    return (
      <button
        type="button"
        data-dashboard-section={item.id}
        onClick={() => pick(item.id)}
        className={cn(
          "font-medium transition",
          mobile
            ? "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold"
            : "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px]",
          active
            ? "bg-accent/10 text-accent ring-1 ring-accent/20"
            : "text-muted-foreground hover:bg-surface hover:text-foreground",
          locked && !active && "opacity-70",
        )}
      >
        <span className="truncate">{item.label}</span>
        {locked ? <Lock className={cn("shrink-0 opacity-50", mobile ? "size-3" : "size-3")} /> : null}
      </button>
    );
  };

  return (
    <>
      <nav
        className="sticky top-0 hidden h-full w-44 shrink-0 flex-col gap-0.5 border-r border-border/60 bg-background/95 p-2 lg:flex"
        data-testid="dashboard-internal-nav"
      >
        {DASHBOARD_NAV.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </nav>

      <div
        className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-sm lg:hidden"
        data-testid="dashboard-mobile-tabs"
      >
        <div
          ref={mobileScrollRef}
          className="flex gap-1 overflow-x-auto px-3 py-2 safe-area-pad-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {DASHBOARD_NAV.map((item) => (
            <NavButton key={item.id} item={item} mobile />
          ))}
        </div>
      </div>
    </>
  );
}
