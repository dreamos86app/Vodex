import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon, ArrowRight, LayoutGrid } from "lucide-react";

export const metadata: Metadata = { title: "Media & Assets" };

export default function MediaPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/25">
        <ImageIcon className="size-8 text-accent" strokeWidth={1.5} />
      </div>
      <div className="max-w-sm">
        <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
          Media lives inside your apps
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Assets are now organized per project. Open any app and go to the{" "}
          <strong className="text-foreground">Media</strong> tab to upload, manage, and view files.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent/90"
        >
          <LayoutGrid className="size-4" strokeWidth={2} />
          Go to your apps
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
