import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PlatformShell } from "@/components/layout/platform-shell";
import { PublicMarketingShell } from "@/components/marketing/public-marketing-shell";
import { getServerSessionUser } from "@/lib/auth/session";

/**
 * Renders legal/policy pages inside the app shell when signed in,
 * or the public marketing shell when signed out.
 */
export async function LegalDocumentShell({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser();

  if (user) {
    return (
      <PlatformShell homeSessionFromServer>
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/help/docs/policies"
            className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition hover:text-accent"
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
            Policies & help
          </Link>
          {children}
        </div>
      </PlatformShell>
    );
  }

  return <PublicMarketingShell>{children}</PublicMarketingShell>;
}
