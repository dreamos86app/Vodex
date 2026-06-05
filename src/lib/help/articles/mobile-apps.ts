import type { HelpArticle } from "@/lib/help/cms/types";

const MOBILE_CHECKLIST = [
  { id: "account", label: "Developer account created" },
  { id: "assets", label: "Icons and screenshots ready" },
  { id: "legal", label: "Privacy policy + terms published" },
  { id: "build", label: "AAB/IPA built in Vodex" },
  { id: "testing", label: "Internal testing passed" },
  { id: "production", label: "Store listing submitted" },
];

export const MOBILE_ARTICLES: HelpArticle[] = [
  {
    slug: "android-publishing",
    categorySlug: "mobile-apps",
    legacySlug: "play-store-setup",
    title: "Android Publishing Guide",
    description: "Play Console, AAB, signing, SHA keys, and production rollout.",
    category: "Mobile Apps",
    readMinutes: 20,
    difficulty: "intermediate",
    relatedSlugs: ["payments/revenuecat", "mobile-apps/ios-publishing"],
    checklist: MOBILE_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Publish your Vodex web app as an Android App Bundle (AAB) on Google Play.

## Developer account

1. [Google Play Console](https://play.google.com/console) — **$25 one-time** registration.
2. Complete identity verification (can take days).

## Fees

- Google Play registration: $25 one-time.
- Google takes 15–30% on in-app purchases (standard store terms).

## Store requirements

- App icon 512×512
- Feature graphic 1024×500
- Phone screenshots (min 2)
- Short + full description
- Content rating questionnaire
- Target API level per Google policy

## App icons & screenshots

Prepare in **Dashboard → Mobile**. Use real device frames where possible.

## Privacy policy & terms

Host public URLs — required before production. Link in store listing and in-app.

## RevenueCat (optional)

For subscriptions, configure RevenueCat before store submission. Match product IDs.

## SHA keys

Play App Signing uses Google-managed keys. Upload key from Vodex Android builder output.

For Firebase/Google Sign-In: add SHA-1/SHA-256 fingerprints to Firebase console.

## Keystore & signing

Vodex builder produces signed AAB. **Back up keystore** if self-managing — loss means you cannot update the app.

## Internal testing

1. Play Console → **Internal testing** track.
2. Upload AAB from Vodex builder.
3. Add tester emails.
4. Install via Play link — verify auth, payments, deep links.

## Production rollout

1. Promote release to **Production**.
2. Start with staged rollout (e.g. 10%).
3. Monitor crashes and reviews.

## Common failures

| Issue | Fix |
|-------|-----|
| Rejected for policy | Read Play email; fix data safety form |
| Signing mismatch | Use same upload key |
| Deep links broken | Verify asset links / intent filters |

## Checklist progress

Track items in Vodex Mobile dashboard checklist (coming in workspace) — mark each step complete before submit.
`,
  },
  {
    slug: "ios-publishing",
    categorySlug: "mobile-apps",
    title: "iOS Publishing Guide",
    description: "Apple Developer Program, App Store Connect, and TestFlight.",
    category: "Mobile Apps",
    readMinutes: 22,
    difficulty: "advanced",
    relatedSlugs: ["mobile-apps/android-publishing", "payments/revenuecat"],
    checklist: MOBILE_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Developer account

[Apple Developer Program](https://developer.apple.com/programs/) — **$99/year**.

## Fees

- $99/year membership.
- Apple commission 15–30% on IAP (per App Store terms).

## Store requirements

- App icons (all required sizes)
- Screenshots per device class
- Privacy nutrition labels
- Export compliance answers

## Signing

Apple uses certificates + provisioning profiles. Vodex iOS builder guides certificate setup.

## TestFlight

1. Upload build to App Store Connect.
2. Internal testers (team) → external testers (beta review).
3. Fix crashes before public release.

## RevenueCat

Configure iOS app in RevenueCat with bundle ID matching App Store Connect.

## Common failures

- Missing privacy manifest
- Guideline 4.3 spam (differentiate your app)
- IAP without RevenueCat/store products configured

## Production rollout

Submit for App Review. Typical review 24–48h. Respond quickly to rejection notes.
`,
  },
];
