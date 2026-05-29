"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CreateServerComposerIsland, readPendingCreatePrompt } from "@/components/create/create-server-composer-island";
import { CreateWorkspaceEntry } from "@/components/create/create-workspace-entry";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isE2eCreditTestAccount } from "@/lib/credits/e2e-credit-account";

export type CreatePageBodyProps = {
  initialPrompt?: string;
  initialProjectId?: string | null;
  initialMode?: string;
  initialAutoStart?: boolean;
  initialStrategy?: string;
  initialModel?: string;
  initialSkipDraft?: boolean;
};

function CreateOnboardingBanner() {
  const profile = useAuthStore((s) => s.profile);
  const email = profile?.email;
  if (profile?.onboarding_completed === true) return null;
  if (isE2eCreditTestAccount(email)) return null;

  return (
    <div
      className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[12px] text-amber-950 dark:text-amber-100"
      data-testid="create-onboarding-banner"
    >
      <Link
        href="/onboarding?next=%2Fcreate"
        className="font-semibold underline"
      >
        Complete quick setup
      </Link>{" "}
      (2 min) — you can keep building below without leaving this page.
    </div>
  );
}

export function CreatePageBody(props: CreatePageBodyProps) {
  const [workspaceReady, setWorkspaceReady] = React.useState(false);
  const pending = readPendingCreatePrompt();
  const mergedPrompt = props.initialPrompt || pending || "";

  const loadingHint = null;

  React.useEffect(() => {
    const check = () => {
      const immersiveShell = document.querySelector(
        '[data-testid="builder-shell"]:not([data-create-server-shell="true"])',
      );
      if (immersiveShell) setWorkspaceReady(true);
    };
    check();
    const id = window.setInterval(check, 150);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background" data-testid="create-page-root">
      <CreateOnboardingBanner />
      <CreateServerComposerIsland
        initialPrompt={mergedPrompt}
        hidden={workspaceReady}
        loadingHint={loadingHint}
      />
      <div
        className={cn(
          "relative h-full w-full",
          !workspaceReady && "pointer-events-none opacity-0",
        )}
        aria-hidden={!workspaceReady}
        data-testid="create-workspace-layer"
      >
        <CreateWorkspaceEntry
          {...props}
          initialPrompt={mergedPrompt}
          onWorkspaceShellReady={() => setWorkspaceReady(true)}
        />
      </div>
    </div>
  );
}
