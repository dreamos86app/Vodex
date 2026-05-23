"use client";

export function CreateStepSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl bg-surface/60 p-4 ring-1 ring-border">
      <div className="h-3 w-1/3 rounded bg-muted" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl bg-muted/70" />
      ))}
    </div>
  );
}
