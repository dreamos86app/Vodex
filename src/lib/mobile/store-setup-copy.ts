/** Step-by-step copy shown under store credential / signing fields. */

export const PLAY_CONSOLE_SETUP_STEPS = [
  "Create a Google Play Developer account ($25 one-time) and finish identity verification.",
  "Create your app in Play Console → set the same package name as Android app ID above.",
  "Under Release → Setup → App signing, copy SHA-256 and SHA-1 from your upload key (or Vodex build key).",
  "Paste both fingerprints below — you can add multiple keys (debug + release + Vodex wrapper).",
  "Enable Google Play App Signing; download the service account JSON only when using automated upload.",
] as const;

export const APP_STORE_SETUP_STEPS = [
  "Enroll in Apple Developer Program ($99/year) and accept agreements in App Store Connect.",
  "Create an App ID matching your iPhone bundle ID above.",
  "Create certificates, provisioning profiles, and an App Store Connect API key for CI uploads.",
  "Configure Sign in with Apple / privacy nutrition labels before submission.",
] as const;

export const REVENUECAT_IMPORTANCE = `RevenueCat is strongly recommended for in-app purchases and subscriptions on both stores. Connect your store products in RevenueCat, add the SDK to your web app, and paste your public API key in project secrets — without it, store billing and restore flows often fail review.`;

export const PLAY_SHA_HELP =
  "Android requires your signing certificate fingerprints in Play Console and in assetlinks.json (TWA). Add every key you use: local debug, Play App Signing, and Vodex wrapper builds.";
