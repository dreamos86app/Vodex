import Link from "next/link";

export function PublicAppNotFound({ slug }: { slug?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="max-w-md rounded-2xl bg-surface p-8 text-center ring-1 ring-border">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          DreamOS86
        </p>
        <h1 className="mt-2 text-[20px] font-semibold text-foreground">App not published</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {slug
            ? `“${slug}” is not available — it may have been unpublished or never existed.`
            : "This public app is not available."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white"
        >
          Go to DreamOS86
        </Link>
      </div>
    </div>
  );
}
