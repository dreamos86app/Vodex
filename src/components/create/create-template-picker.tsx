"use client";

import { cn } from "@/lib/utils";
import { LayoutGrid, BarChart3, Smartphone, Bot, Check } from "lucide-react";

export type CreateTemplate = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: React.ElementType;
};

export const CREATE_TEMPLATES: CreateTemplate[] = [
  {
    id: "saas",
    label: "SaaS dashboard",
    description: "Analytics, teams, billing",
    prompt: "Build a SaaS dashboard with analytics, team management, billing, and role-based access.",
    icon: BarChart3,
  },
  {
    id: "mobile",
    label: "Mobile app",
    description: "Responsive, touch-friendly",
    prompt: "Build a mobile-first web app with authentication, push-ready API, and responsive UI.",
    icon: Smartphone,
  },
  {
    id: "ai",
    label: "AI tool",
    description: "Chat, history, actions",
    prompt: "Build an AI-powered tool with streaming responses, prompt history, and user settings.",
    icon: Bot,
  },
  {
    id: "custom",
    label: "Custom",
    description: "From your description",
    prompt: "",
    icon: LayoutGrid,
  },
];

export function CreateTemplatePicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (t: CreateTemplate) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CREATE_TEMPLATES.map((t) => {
        const Icon = t.icon;
        const active = selectedId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={cn(
              "relative flex min-h-[96px] w-full max-w-full flex-col items-start rounded-2xl p-4 text-left ring-1 transition",
              active
                ? "bg-accent/10 ring-accent/40 shadow-sm"
                : "bg-surface ring-border hover:ring-accent/25 hover:shadow-sm",
            )}
          >
            {active && <Check className="absolute right-3 top-3 size-4 text-accent" />}
            <Icon className={cn("size-5", active ? "text-accent" : "text-muted-foreground")} strokeWidth={1.75} />
            <span className="mt-3 text-[13px] font-semibold text-foreground">{t.label}</span>
            <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.description}</span>
          </button>
        );
      })}
    </div>
  );
}
