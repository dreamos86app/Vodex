export type StoreWizardPlatform = "google_play" | "apple_app_store";

export type StoreWizardStep = {
  id: string;
  title: string;
  description: string;
  required: boolean;
};

export const GOOGLE_PLAY_WIZARD_STEPS: StoreWizardStep[] = [
  {
    id: "gp_account",
    title: "Create Google Play Developer account",
    description: "Sign up at play.google.com/console and pay the one-time $25 registration fee.",
    required: true,
  },
  {
    id: "gp_app",
    title: "Create your app listing",
    description: "Add app name, default language, and app type (app/game).",
    required: true,
  },
  {
    id: "gp_signing",
    title: "Enable Play App Signing",
    description: "Use Google-managed signing. Save upload key and app signing certificates.",
    required: true,
  },
  {
    id: "gp_sha",
    title: "Add SHA-256 & SHA-1 fingerprints",
    description: "Paste all keys in Vodex Mobile → Advanced (upload, signing, Firebase, legacy).",
    required: true,
  },
  {
    id: "gp_oauth",
    title: "Configure OAuth / API access",
    description: "Create service account for automated uploads if using CI.",
    required: false,
  },
  {
    id: "gp_revenuecat",
    title: "Connect RevenueCat",
    description: "Link Google Play products to RevenueCat offerings and entitlements.",
    required: true,
  },
  {
    id: "gp_verify",
    title: "Verify configuration",
    description: "Run Vodex eligibility scan — all critical checks must pass.",
    required: true,
  },
];

export const APPLE_WIZARD_STEPS: StoreWizardStep[] = [
  {
    id: "apple_dev",
    title: "Enroll in Apple Developer Program",
    description: "$99/year — accept agreements in developer.apple.com.",
    required: true,
  },
  {
    id: "apple_bundle",
    title: "Register Bundle ID",
    description: "Must match your iPhone app ID in Vodex Mobile setup.",
    required: true,
  },
  {
    id: "apple_certs",
    title: "Certificates & profiles",
    description: "Distribution certificate + App Store provisioning profile.",
    required: true,
  },
  {
    id: "apple_api",
    title: "App Store Connect API key",
    description: "Issuer ID, Key ID, and .p8 private key in Vodex secure setup.",
    required: true,
  },
  {
    id: "apple_revenuecat",
    title: "Connect RevenueCat (Apple IAP)",
    description: "Map App Store products to RevenueCat entitlements.",
    required: true,
  },
  {
    id: "apple_verify",
    title: "Verify configuration",
    description: "Run Vodex eligibility scan before queuing iOS export.",
    required: true,
  },
];

export type StoreOnboardingProgress = {
  google_play: Record<string, boolean>;
  apple_app_store: Record<string, boolean>;
};

export function wizardProgressPercent(
  platform: StoreWizardPlatform,
  progress: StoreOnboardingProgress | null | undefined,
): number {
  const steps = platform === "google_play" ? GOOGLE_PLAY_WIZARD_STEPS : APPLE_WIZARD_STEPS;
  const map =
    platform === "google_play" ? progress?.google_play : progress?.apple_app_store;
  if (!map) return 0;
  const required = steps.filter((s) => s.required);
  const done = required.filter((s) => map[s.id]).length;
  return required.length ? Math.round((done / required.length) * 100) : 0;
}

export function canAdvanceWizardStep(
  steps: StoreWizardStep[],
  progress: Record<string, boolean>,
  stepId: string,
): boolean {
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx <= 0) return true;
  for (let i = 0; i < idx; i++) {
    if (steps[i].required && !progress[steps[i].id]) return false;
  }
  return true;
}
