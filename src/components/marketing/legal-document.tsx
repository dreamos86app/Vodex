import { cn } from "@/lib/utils";

export function LegalProse({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        "prose-legal mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14",
        "text-[14px] leading-relaxed text-foreground",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalParagraph({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}
