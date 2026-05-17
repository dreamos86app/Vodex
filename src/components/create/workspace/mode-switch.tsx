"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { MessageCircle, Pencil, Zap } from "lucide-react";
import type { CreationMode } from "@/lib/creation/models";
import { MODE_META } from "@/lib/creation/models";
import { cn } from "@/lib/utils";

const MODES: Array<{ id: CreationMode; icon: React.ElementType }> = [
  { id: "discuss", icon: MessageCircle },
  { id: "edit", icon: Pencil },
  { id: "build", icon: Zap },
];

export function ModeSwitch({
  value,
  onChange,
  className,
  compact = false,
}: {
  value: CreationMode;
  onChange: (mode: CreationMode) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Creation mode"
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-lg bg-surface p-0.5 ring-1 ring-border",
        className,
      )}
    >
      {MODES.map(({ id, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(id)}
            title={MODE_META[id].description}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="mode-active"
                className="absolute inset-0 -z-10 rounded-[6px] bg-background shadow-[var(--shadow-xs)] ring-1 ring-border"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
            <Icon className="size-3.5" strokeWidth={1.75} />
            {!compact && MODE_META[id].label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Edit-mode scope picker ───────────────────────────────────────────────────

export type EditScope =
  | "ui"
  | "component"
  | "page"
  | "layout"
  | "workflow"
  | "api"
  | "schema"
  | "animation"
  | "auth";

export const EDIT_SCOPES: Array<{
  id: EditScope;
  label: string;
  description: string;
}> = [
  { id: "ui", label: "UI section", description: "A visual region (hero, grid, sidebar)" },
  { id: "component", label: "Component", description: "A single reusable component" },
  { id: "page", label: "Page", description: "A whole route + layout" },
  { id: "layout", label: "Layout", description: "Shell, navigation, structure" },
  { id: "workflow", label: "Workflow", description: "Multi-step user flow" },
  { id: "api", label: "API", description: "A specific route handler" },
  { id: "schema", label: "Schema", description: "Database tables / RLS / types" },
  { id: "animation", label: "Animation", description: "Motion / transition / interaction" },
  { id: "auth", label: "Auth flow", description: "Sign-in, signup, session, roles" },
];

export function ScopePicker({
  value,
  onChange,
  className,
}: {
  value: EditScope | null;
  onChange: (scope: EditScope | null) => void;
  className?: string;
}) {
  const current = EDIT_SCOPES.find((s) => s.id === value);
  return (
    <select
      value={value ?? ""}
      onChange={(e) =>
        onChange((e.target.value as EditScope) || null)
      }
      title={current?.description ?? "Choose what to scope this edit to"}
      className={cn(
        "h-7 cursor-pointer appearance-none rounded-md bg-surface px-2 pr-6 text-[12px] font-medium text-foreground ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-ring",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23667%22 stroke-width=%221.75%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:10px_10px] bg-[right_6px_center] bg-no-repeat",
        className,
      )}
    >
      <option value="">Choose scope…</option>
      {EDIT_SCOPES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
