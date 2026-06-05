export default function AppLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b border-border/60 px-6 py-4">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-muted/50" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-muted/30" />
      </div>
      <div className="flex flex-1 gap-4 p-6">
        <div className="hidden w-52 shrink-0 space-y-2 md:block">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-muted/40" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-muted/30" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted/25" />
        </div>
      </div>
    </div>
  );
}
