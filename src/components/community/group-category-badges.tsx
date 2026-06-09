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
            "rounded-full bg-blue-500/10 font-medium text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
          )}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
