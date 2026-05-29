import { PlatformShell } from "@/components/layout/platform-shell";
import { PublicMarketingShell } from "@/components/marketing/public-marketing-shell";
import { PricingView } from "@/components/pricing/pricing-view";
import { getServerSessionUser } from "@/lib/auth/session";

/**
 * Single /pricing route: app shell when signed in, public marketing shell when signed out.
 */
export async function PricingPageShell() {
  const user = await getServerSessionUser();

  if (user) {
    return (
      <PlatformShell homeSessionFromServer>
        <div data-testid="app-pricing-page">
          <PricingView />
        </div>
      </PlatformShell>
    );
  }

  return (
    <PublicMarketingShell className="bg-atmosphere">
      <div data-testid="public-pricing-page" className="pb-16">
        <PricingView publicMode />
      </div>
    </PublicMarketingShell>
  );
}
