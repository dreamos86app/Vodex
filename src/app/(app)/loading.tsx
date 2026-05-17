import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground/40" strokeWidth={1.75} />
        <p className="text-[12px] text-muted-foreground/40">Loading DreamOS86…</p>
      </div>
    </div>
  );
}
