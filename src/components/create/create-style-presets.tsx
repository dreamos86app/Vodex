"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StylePreset = {
  id: string;
  label: string;
  hint: string;
};

export const STYLE_PRESETS: StylePreset[] = [
  { id: "minimal", label: "Minimal", hint: "Clean whitespace, subtle borders" },
  { id: "bold", label: "Bold", hint: "Strong contrast, large type" },
  { id: "glass", label: "Glass", hint: "Soft blur and gradients" },
  { id: "enterprise", label: "Enterprise", hint: "Dense, professional data UI" },
];

export function CreateStylePresets({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (p: StylePreset) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {STYLE_PRESETS.map((p) => {
        const active = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition",
              active ? "bg-accent/10 ring-accent/40" : "bg-surface ring-border hover:ring-accent/25",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-1",
                active ? "bg-accent text-white ring-accent" : "bg-background ring-border",
              )}
            >
              {active && <Check className="size-3" strokeWidth={2.5} />}
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-foreground">{p.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{p.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
