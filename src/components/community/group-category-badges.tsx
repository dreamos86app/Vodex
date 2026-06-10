import { cn } from "@/lib/utils";

export function parseGroupCategories(input: {
  categories?: string[] | null;
  category?: string | null;
}): string[] {
  if (Array.isArray(input.categories) && input.categories.length > 0) {
    return input.categories.filter(Boolean);
  }
  if (input.category?.trim()) return [input.category.trim()];
  return ["General"];
}

const CATEGORY_STYLES: Record<string, string> = {
  General: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-200",
  SaaS: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  AI: "bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/25 dark:text-fuchsia-300",
  Frontend: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  Backend: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
  Mobile: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  Indie: "bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-300",
  Design: "bg-pink-500/10 text-pink-700 ring-pink-500/25 dark:text-pink-300",
  "Open Source": "bg-teal-500/10 text-teal-700 ring-teal-500/25 dark:text-teal-300",
  Web3: "bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300",
  Other: "bg-blue-500/10 text-blue-700 ring-blue-500/25 dark:text-blue-300",
};

function styleForCategory(category: string): string {
  return CATEGORY_STYLES[category] ?? "bg-accent/10 text-accent ring-accent/20";
}

export function GroupCategoryBadges({
  categories,
  className,
  compact,
}: {
  categories: string[];
  className?: string;
  compact?: boolean;
}) {
  const list = categories.length ? categories : ["General"];
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {list.map((c) => (
        <span
          key={c}
          className={cn(
            "rounded-full font-semibold ring-1",
            styleForCategory(c),
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
          )}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
