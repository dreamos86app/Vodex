import Link from "next/link";
import { LogoIcon } from "@/components/ui/logo-icon";
import { cn } from "@/lib/utils";

export const SUPPORT_EMAIL = "support@dreamos86.com";

export function PublicMarketingHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="DreamOS86 home">
          <LogoIcon size={36} />
          <span className="text-[14px] font-semibold tracking-tight text-foreground">DreamOS86</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Public">
          <Link
            href="/"
            className="hidden rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:bg-surface hover:text-foreground sm:inline-block"
          >
            Home
          </Link>
          <Link
            href="/privacy"
            className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:bg-surface hover:text-foreground sm:px-3"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:bg-surface hover:text-foreground sm:px-3"
          >
            Terms
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:bg-surface hover:text-foreground sm:px-3"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-accent/90 sm:px-3.5"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicMarketingFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border/60 bg-background/90", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon size={28} />
            <span className="text-[13px] font-semibold text-foreground">DreamOS86</span>
          </Link>
          <p className="text-center text-[11px] text-muted-foreground sm:text-left">
            © {new Date().getFullYear()} DreamOS86. All rights reserved.
          </p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px]" aria-label="Legal">
          <Link
            href="/privacy"
            className="text-muted-foreground transition hover:text-foreground hover:underline underline-offset-4"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground transition hover:text-foreground hover:underline underline-offset-4"
          >
            Terms
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-muted-foreground transition hover:text-foreground hover:underline underline-offset-4"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function PublicMarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-h-screen flex-col bg-atmosphere", className)}>
      <PublicMarketingHeader />
      <main className="relative z-10 flex-1">{children}</main>
      <PublicMarketingFooter />
    </div>
  );
}
