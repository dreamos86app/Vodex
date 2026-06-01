import { PlatformShell } from "@/components/layout/platform-shell";
import { OnboardingAppGate } from "@/components/onboarding/onboarding-app-gate";
import { getServerSessionUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser();
  return (
    <PlatformShell homeSessionFromServer={Boolean(user)}>
      <OnboardingAppGate>{children}</OnboardingAppGate>
    </PlatformShell>
  );
}
