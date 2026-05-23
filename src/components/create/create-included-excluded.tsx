"use client";

import { Check, X } from "lucide-react";

export function CreateIncludedExcluded() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-positive/5 px-3 py-3 ring-1 ring-positive/15">
        <p className="text-[11px] font-semibold text-positive">Included</p>
        <ul className="mt-2 space-y-1.5 text-[11px] text-foreground/90">
          {["App pages & navigation", "Starter UI matching your style", "Database & auth scaffolding", "Preview when ready"].map(
            (item) => (
              <li key={item} className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-3 shrink-0 text-positive" />
                {item}
              </li>
            ),
          )}
        </ul>
      </div>
      <div className="rounded-xl bg-muted/40 px-3 py-3 ring-1 ring-border">
        <p className="text-[11px] font-semibold text-muted-foreground">Not included yet</p>
        <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
          {["Custom domain setup", "Production hosting", "App store submission", "Third-party API keys"].map(
            (item) => (
              <li key={item} className="flex items-start gap-1.5">
                <X className="mt-0.5 size-3 shrink-0" />
                {item}
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
