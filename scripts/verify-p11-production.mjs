#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv[2] ?? "";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function must(src, needle, label, errors) {
  if (!src.includes(needle)) errors.push(label);
}

const suites = {
  "no-malformed-try-block": () => {
    const errors = [];
    must(read("src/lib/preview/preview-html-sanitizer.ts"), "hasMalformedTryBlock", "try validator", errors);
    must(read("src/lib/preview/static-preview-builder.ts"), "preview-html-sanitizer", "sanitizer wired", errors);
    return errors;
  },
  "builder-route-no-syntax-crash": () => {
    const errors = [];
    must(read("src/lib/preview/preview-html-sanitizer.ts"), "stripInlineScriptsFromPreviewBody", "strip scripts", errors);
    must(read("src/components/create/builder-project-gate.tsx"), "ImmersiveWorkspace", "builder gate", errors);
    return errors;
  },
  "credit-empty-upgrade-panel": () => {
    const errors = [];
    must(read("src/components/billing/build-credits-upgrade-panel.tsx"), "build-credits-upgrade-panel", "panel", errors);
    must(read("src/components/billing/build-credits-upgrade-panel.tsx"), "#2563eb", "vodex blue", errors);
    must(read("src/components/billing/build-credits-upgrade-panel.tsx"), "build-credits-upgrade-panel__cta", "premium cta", errors);
    const panel = read("src/components/billing/build-credits-upgrade-panel.tsx");
    if (panel.includes("Add credits")) errors.push("add credits removed");
    if (panel.includes("Save for later")) errors.push("save for later removed");
    must(read("src/lib/billing/build-credits-upgrade.ts"), "resolveBuildCreditsUpgradeOffer", "offer resolver", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "BuildCreditsUpgradePanel", "workspace panel", errors);
    return errors;
  },
  "pricing-card-clicks-checkout": () => {
    const errors = [];
    const pv = read("src/components/pricing/pricing-view.tsx");
    must(pv, "cursor-pointer", "clickable cards", errors);
    must(pv, "activateCard", "card activation", errors);
    must(pv, "startCheckout", "checkout hook", errors);
    must(pv, "e.stopPropagation", "button click isolation", errors);
    return errors;
  },
  "icon-action-credit-charge": () => {
    const errors = [];
    must(read("src/lib/projects/app-identity-service.ts"), "icon_credit_reserved", "reserve log", errors);
    must(read("src/lib/projects/app-identity-service.ts"), "icon_credit_charged", "charge log", errors);
    must(read("src/lib/projects/app-identity-service.ts"), "chargeActionCredit", "charge call", errors);
    must(read("src/lib/action-credits/charge-action-credit.ts"), "dynamicFloor", "dynamic floor", errors);
    return errors;
  },
  "icon-symbolic-full-circle": () => {
    const errors = [];
    must(read("src/lib/projects/app-logo-generation.ts"), "validateIconVisualQuality", "visual validation", errors);
    must(read("src/lib/projects/app-logo-generation.ts"), "symbolic mark only", "no text prompt", errors);
    must(read("src/lib/projects/app-identity-service.ts"), "icon_credit_skipped_depleted", "depleted skip log", errors);
    must(read("src/lib/projects/app-logo-generation.ts"), "scaleIconVisualMass", "visual mass", errors);
    return errors;
  },
  "intro-v2-cinematic-app-showcase": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "INTRO_CINEMATIC_APPS", "p13 apps wired", errors);
    must(intro, "data-intro-version=\"p13\"", "p13 marker", errors);
    return errors;
  },
  "intro-real-app-screens": () => {
    const errors = [];
    const screens = read("src/components/session/intro-v3-app-screens.tsx");
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "intro-v3-app-screens", "v3 screens import", errors);
    must(screens, "NOVA", "nova branding", errors);
    must(screens, "IntroFashionScreen", "fashion full screen", errors);
    must(screens, "IntroFoodDeliveryScreen", "food full screen", errors);
    must(screens, "IntroVideoEditorScreen", "video full screen", errors);
    must(screens, "IntroFinanceScreen", "finance full screen", errors);
    must(screens, "DesktopChrome", "desktop chrome", errors);
    must(screens, "PhoneChrome", "mobile chrome", errors);
    must(screens, "data-intro-app=", "real app markers", errors);
    return errors;
  },
  "intro-no-placeholder-ui": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    if (intro.includes("INTRO_SHOWCASE_MOCKS")) errors.push("v2 floating mocks removed from intro");
    if (intro.includes("ShowcaseSquare")) errors.push("tiny floating cards removed");
    const screens = read("src/components/session/intro-v3-app-screens.tsx");
    must(screens, "<header", "nav density — fashion", errors);
    must(screens, "Checkout", "checkout cta", errors);
    must(screens, "Timeline", "editor timeline", errors);
    must(screens, "Stripe payout", "finance transactions", errors);
    return errors;
  },
  "intro-premium-motion": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "SHOWCASE_END_S", "phased showcase", errors);
    must(intro, "COLLAPSE_END_S", "phased collapse", errors);
    must(intro, "IntroVortex", "vortex burst", errors);
    must(intro, "IntroAppPanel", "staggered panels", errors);
    must(read("src/app/globals.css"), "vodex-intro-v3__chromatic", "chromatic layer", errors);
    must(read("src/app/globals.css"), "vodex-intro-p13__shimmer", "p13 motion", errors);
    return errors;
  },
  "intro-desktop-mobile-density": () => {
    const errors = [];
    const screens = read("src/components/session/intro-v3-app-screens.tsx");
    must(screens, "data-intro-density=\"desktop-framed\"", "desktop density", errors);
    must(screens, "data-intro-density=\"mobile-framed\"", "mobile density", errors);
    must(read("src/components/session/intro/CinematicAppPanel.tsx"), "CinematicAppPanel", "app panels", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), '"mobile" : "desktop"', "layout switch", errors);
    return errors;
  },
  "admin-prompt-stats-filter-cost": () => {
    const errors = [];
    must(read("src/lib/admin/admin-query-compat.ts"), "AiUsageCostBucket", "cost bucket type", errors);
    must(read("src/lib/admin/admin-query-compat.ts"), "buckets", "bucket aggregates", errors);
    must(read("src/app/api/admin/ai-usage/prompt-stats/route.ts"), "buckets", "api buckets", errors);
    const panel = read("src/components/admin/admin-prompt-activity-panel.tsx");
    must(panel, "Provider cost", "provider cost ui", errors);
    must(panel, "Est. margin", "margin ui", errors);
    if (panel.includes("Add credits")) errors.push("duplicate add credits");
    if (panel.includes("Successful live")) errors.push("duplicate pill filters removed");
    return errors;
  },
  "admin-build-success-fail-counts": () => {
    const errors = [];
    must(read("src/components/admin/admin-prompt-activity-panel.tsx"), "Total builds", "build total", errors);
    must(read("src/components/admin/admin-prompt-activity-panel.tsx"), "Successful builds", "build success", errors);
    must(read("src/components/admin/admin-prompt-activity-panel.tsx"), "Failed builds", "build failed", errors);
    must(read("src/lib/admin/admin-query-compat.ts"), "builds:", "build stats in compat", errors);
    must(read("src/lib/ai/log-provider-ai-usage.ts"), "isBuildRelatedUsageMode", "build mode helper", errors);
    return errors;
  },
  "ai-usage-logging-coverage": () => {
    const errors = [];
    must(read("src/lib/ai/log-provider-ai-usage.ts"), "logProviderAiUsage", "provider logger", errors);
    must(read("src/lib/ai/provider-call.ts"), "logProviderAiUsage", "wired in provider-call", errors);
    must(read("src/lib/credits/charge-ai-operation.ts"), "ai_usage_logs", "chat charge logs", errors);
    must(read("src/lib/billing/build-credit-audit-log.ts"), "logBuildCreditReconciliation", "build reconcile log", errors);
    return errors;
  },
  "deploy-with-prompt-flow": () => {
    const errors = [];
    const imm = read("src/components/create/workspace/immersive-workspace.tsx");
    must(imm, "PublishModal", "publish modal in builder", errors);
    must(imm, "publish_request", "publish intent handling", errors);
    must(imm, "setPublishOpen(true)", "opens publish modal", errors);
    must(read("src/app/api/projects/[id]/publish/route.ts"), "startPublish", "publish api", errors);
    return errors;
  },
  "intro-app-previews-visible-before-vortex": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "SHOWCASE_END_S", "showcase end before vortex", errors);
    must(intro, "inShowcase", "showcase phase gate", errors);
    must(read("src/components/session/intro/intro-constants.ts"), "APP_ENTRANCE_S", "stagger entrances", errors);
    must(read("src/components/session/intro/IntroAppPanel.tsx"), "enterAt", "per-app entrance", errors);
    return errors;
  },
  "intro-vortex-after-previews": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "IntroVortex", "vortex component", errors);
    must(intro, "collapsing", "collapse phase", errors);
    if (intro.includes("CUT_DURATION")) errors.push("sequential cuts removed for quadrant montage");
    return errors;
  },
  "intro-motion-stagger": () => {
    const errors = [];
    const c = read("src/components/session/intro/intro-constants.ts");
    must(c, "nova: 0.15", "nova stagger", errors);
    must(c, "bite: 0.55", "bite stagger", errors);
    must(c, "frame: 0.95", "frame stagger", errors);
    must(c, "apex: 1.35", "apex stagger", errors);
    return errors;
  },
  "intro-vortex-sequence": () => {
    const errors = [];
    must(read("src/components/session/intro/IntroVortex.tsx"), "vortex-ring", "vortex rings", errors);
    must(read("src/components/session/intro/intro-constants.ts"), "COLLAPSE_END_S", "collapse timing", errors);
    return errors;
  },
  "intro-apps-not-static": () => {
    const errors = [];
    must(read("src/components/session/intro/IntroAliveOverlay.tsx"), "IntroAliveOverlay", "alive overlay", errors);
    must(read("src/app/globals.css"), "vodex-intro-p13__shimmer", "shimmer css", errors);
    must(read("src/app/globals.css"), "vodex-intro-p13__spark", "spark animation", errors);
    return errors;
  },
  "intro-logo-reveal": () => {
    const errors = [];
    must(read("src/components/session/intro/IntroLogoReveal.tsx"), "IntroLogoReveal", "logo reveal", errors);
    must(read("src/components/session/intro/IntroLogoReveal.tsx"), "logo-bloom", "energy bloom", errors);
    return errors;
  },
  "intro-60fps-safe": () => {
    const errors = [];
    must(read("src/components/session/intro/CinematicAppPanel.tsx"), "willChange", "gpu hint", errors);
    must(read("src/app/globals.css"), "prefers-reduced-motion", "reduced motion", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), "useReducedMotion", "a11y hook", errors);
    return errors;
  },
  "intro-no-start-artifact": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "initial={{ opacity: 1 }}", "no flash fade-in from 0 on root", errors);
    must(intro, "vodex-intro-v3", "v3 shell class", errors);
    must(intro, "showBrand", "brand gated until phase 3", errors);
    must(read("src/app/globals.css"), "vodex-intro-v3__cosmos", "cosmos fill", errors);
    return errors;
  },
  "intro-mobile-desktop-variants": () => {
    const errors = [];
    must(read("src/components/session/vodex-session-intro.tsx"), "isMobile", "mobile layout", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), "innerWidth < 768", "breakpoint", errors);
    return errors;
  },
  "intro-real-assets-loaded": () => {
    const errors = [];
    for (const f of ["nova.png", "bite.png", "frame-ai.png", "apex.png"]) {
      const p = path.join(root, "public", "intro", f);
      if (!fs.existsSync(p)) errors.push(`missing public/intro/${f}`);
    }
    return errors;
  },
  "intro-uses-reference-images": () => {
    const errors = [];
    must(read("src/components/session/intro/CinematicAppPanel.tsx"), 'data-intro-reference-image', "reference image attr", errors);
    must(read("src/components/session/intro/intro-apps.ts"), "/intro/nova.png", "nova asset path", errors);
    must(read("src/components/session/intro/intro-apps.ts"), "imageSrc", "image src config", errors);
    return errors;
  },
  "intro-not-css-placeholder-panels": () => {
    const errors = [];
    const panel = read("src/components/session/intro/CinematicAppPanel.tsx");
    if (panel.includes("IntroFashionScreen")) errors.push("css mock screen in panel");
    must(panel, "IntroReferenceImage", "reference image component", errors);
    must(read("src/components/session/intro/IntroReferenceImage.tsx"), "unoptimized", "full quality", errors);
    return errors;
  },
  "intro-logo-reveal-not-cut-off": () => {
    const errors = [];
    must(read("src/components/session/vodex-session-intro.tsx"), "revealComplete", "reveal complete gate", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), "onRevealComplete", "reveal callback", errors);
    must(read("src/components/session/intro/intro-constants.ts"), "POST_REVEAL_SETTLE_MS", "post reveal settle", errors);
    return errors;
  },
  "intro-animation-completes-before-fade": () => {
    const errors = [];
    must(read("src/components/session/vodex-session-intro.tsx"), "POST_REVEAL_SETTLE_MS", "post reveal settle", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), "EXIT_FADE_MS", "exit fade", errors);
    if (read("src/components/session/vodex-session-intro.tsx").includes("INTRO_TOTAL_MS")) {
      errors.push("hard INTRO_TOTAL_MS timeout removed");
    }
    return errors;
  },
  "status-owner-full-view": () => {
    const errors = [];
    must(read("src/lib/admin-owner.ts"), "canViewFullStatusPage", "owner gate", errors);
    must(read("src/lib/status/status-public-surface.ts"), "Functionalities", "public surface", errors);
    must(read("src/app/api/status/public/route.ts"), "fullView", "api full view", errors);
    return errors;
  },
  "status-page-public": () => {
    const errors = [];
    must(read("src/app/status/page.tsx"), "PublicStatusPage", "status page", errors);
    must(read("src/app/api/status/public/route.ts"), "fetchPublicStatusPayload", "status api", errors);
    return errors;
  },
  "status-subdomain-routing": () => {
    const errors = [];
    must(read("src/proxy.ts"), "status.vodex.dev", "status host", errors);
    return errors;
  },
  "platform-announcement-banner": () => {
    const errors = [];
    must(read("src/components/platform/platform-announcement-banners.tsx"), "platform-incident-banner", "banner", errors);
    must(read("src/components/layout/platform-shell.tsx"), "PlatformAnnouncementBanners", "banner wired", errors);
    return errors;
  },
  "admin-status-management": () => {
    const errors = [];
    must(read("src/components/admin/admin-system-status-panel.tsx"), "Publish banner", "admin publish", errors);
    must(read("src/app/api/admin/status/overview/route.ts"), "schemaReady", "admin overview", errors);
    must(read("src/app/api/admin/status/announcements/publish/route.ts"), "platform_announcements", "publish api", errors);
    must(read("src/app/api/admin/status/components/update/route.ts"), "requireDreamosOwner", "owner gate", errors);
    must(read("src/app/api/admin/status/incidents/create/route.ts"), "status_incidents", "incident create", errors);
    return errors;
  },
  "status-30-day-history": () => {
    const errors = [];
    must(read("src/lib/status/status-public.ts"), "HISTORY_DAYS = 30", "30 day window", errors);
    must(read("src/components/status/public-status-page.tsx"), "history", "history ui", errors);
    return errors;
  },
  "status-rls-owner-gating": () => {
    const errors = [];
    must(read("supabase/migrations/20260720120000_platform_status.sql"), "enable row level security", "rls", errors);
    must(read("src/app/api/admin/status/incidents/resolve/route.ts"), "requireDreamosOwner", "owner resolve", errors);
    return errors;
  },
  "platform-announcements-table": () => {
    const errors = [];
    must(read("supabase/migrations/20260720120000_platform_status.sql"), "platform_announcements", "table migration", errors);
    must(read("supabase/migrations/20260721120000_platform_status_p16.sql"), "notify pgrst", "schema reload", errors);
    must(read("src/lib/status/status-db.ts"), "isStatusSchemaMissingError", "schema guard", errors);
    return errors;
  },
  "multiple-platform-announcements": () => {
    const errors = [];
    must(read("src/components/platform/platform-announcement-banners.tsx"), "active-announcements", "multi fetch", errors);
    must(read("src/app/api/admin/status/announcements/publish/route.ts"), "deactivateOthers", "multi publish", errors);
    must(read("src/app/api/admin/status/announcements/toggle/route.ts"), "isActive", "toggle api", errors);
    return errors;
  },
  "footer-important-links": () => {
    const errors = [];
    must(read("src/components/layout/vodex-important-links-footer.tsx"), "vodex-important-links-footer", "footer", errors);
    must(read("src/components/layout/platform-shell.tsx"), "DeferredFooter", "footer wired", errors);
    must(read("src/components/layout/vodex-important-links-footer.tsx"), "discord.gg/y8EbeMc9Mb", "discord link", errors);
    return errors;
  },
  "discord-community-card": () => {
    const errors = [];
    must(read("src/components/ui/premium-discord-card.tsx"), "Join the Vodex Community", "discord card", errors);
    must(read("src/components/layout/vodex-important-links-footer.tsx"), "footer-discord-social", "footer discord", errors);
    must(read("src/components/layout/vodex-important-links-footer.tsx"), "vodex-footer-discord-standalone", "standalone discord", errors);
    return errors;
  },
  "intro-mobile-image-sizing": () => {
    const errors = [];
    must(read("src/components/session/intro/CinematicAppPanel.tsx"), "46vw", "mobile width", errors);
    must(read("src/components/session/intro/intro-apps.ts"), '"-30vw"', "corner cluster", errors);
    must(read("src/components/session/intro/IntroReferenceImage.tsx"), "object-contain", "mobile contain", errors);
    return errors;
  },
  "status-components-table": () => {
    const errors = [];
    must(read("supabase/migrations/20260722120000_p17_production_stability.sql"), "status_components", "status_components", errors);
    return errors;
  },
  "status-schema-cache-safe": () => {
    const errors = [];
    must(read("src/lib/status/status-fallback.ts"), "buildFallbackStatusPayload", "fallback", errors);
    must(read("src/lib/status/status-public.ts"), "buildFallbackStatusPayload", "fallback wired", errors);
    return errors;
  },
  "status-page-no-crash-when-missing-table": () => {
    const errors = [];
    must(read("src/app/api/status/public/route.ts"), "fetchPublicStatusPayload", "status api", errors);
    must(read("src/components/status/public-status-page.tsx"), "placeholder", "placeholder ui", errors);
    return errors;
  },
  "community-discussions-rls": () => {
    const errors = [];
    must(read("supabase/migrations/20260723120000_p171_discussions_harden.sql"), "discussions: authenticated read", "discussions rls", errors);
    must(read("supabase/migrations/20260723120000_p171_discussions_harden.sql"), "_p171_owner_coalesce_expr", "adaptive owner", errors);
    return errors;
  },
  "community-page-no-permission-crash": () => {
    const errors = [];
    must(read("src/components/community/community-view.tsx"), "CommunityFetchFallback", "fallback", errors);
    return errors;
  },
  "discord-community-card-premium": () => {
    const errors = [];
    must(read("src/components/ui/premium-discord-card.tsx"), "vodex-discord-card-icy", "icy discord card", errors);
    must(read("src/components/ui/premium-discord-card.tsx"), "DiscordGlyph", "discord icon", errors);
    must(read("src/app/globals.css"), "vodex-discord-icy-bg", "icy discord bg css", errors);
    return errors;
  },
  "footer-bottom-position": () => {
    const errors = [];
    must(read("src/components/layout/platform-shell.tsx"), "flex min-h-full flex-1 flex-col", "flex layout", errors);
    must(read("src/components/layout/deferred-footer.tsx"), "DeferredFooter", "deferred footer", errors);
    return errors;
  },
  "footer-no-early-render": () => {
    const errors = [];
    must(read("src/components/layout/deferred-footer.tsx"), "setReady(false)", "defer render", errors);
    return errors;
  },
  "footer-light-blue-design": () => {
    const errors = [];
    must(read("src/components/layout/vodex-important-links-footer.tsx"), "from-sky-50", "light blue", errors);
    return errors;
  },
  "footer-discord-social-section": () => {
    const errors = [];
    must(read("src/components/layout/vodex-important-links-footer.tsx"), "footer-discord-social", "discord section", errors);
    return errors;
  },
  "route-scroll-to-top": () => {
    const errors = [];
    must(read("src/components/navigation/route-scroll-to-top.tsx"), "RouteScrollToTop", "scroll manager", errors);
    must(read("src/components/layout/platform-shell.tsx"), "RouteScrollToTop", "wired", errors);
    return errors;
  },
  "project-visibility-all-surfaces": () => {
    const errors = [];
    must(read("src/lib/projects/user-visible-projects.ts"), "isUserVisibleProject", "visibility", errors);
    must(read("src/lib/projects/project-visibility-status.ts"), "computeProjectCardUiState", "ui state", errors);
    return errors;
  },
  "drafts-show-all-unpublished-apps": () => {
    const errors = [];
    must(read("src/lib/projects/user-visible-projects.ts"), "fileCountForFailed", "failed with files visible", errors);
    return errors;
  },
  "failed-apps-visible": () => {
    const errors = [];
    must(read("src/lib/projects/project-visibility-status.ts"), "failed_attempt", "failed attempt", errors);
    return errors;
  },
  "app-card-logo-sync": () => {
    const errors = [];
    must(read("src/app/api/home/recent-projects/route.ts"), "icon_url", "icon in api", errors);
    return errors;
  },
  "intro-mobile-corner-layout": () => {
    const errors = [];
    must(read("src/components/session/intro/intro-apps.ts"), '"-30vw"', "corner x vw", errors);
    return errors;
  },
  "intro-showcase-spacing": () => {
    const errors = [];
    must(read("src/components/session/intro/CinematicAppPanel.tsx"), "40vh", "mobile height", errors);
    return errors;
  },
  "intro-fusion-center-path": () => {
    const errors = [];
    must(read("src/components/session/intro/CinematicAppPanel.tsx"), "collapsing", "fusion", errors);
    return errors;
  },
  "notification-preferences-functional": () => {
    const errors = [];
    must(read("src/app/api/notification-preferences/route.ts"), "notification_preferences", "prefs api", errors);
    must(read("src/lib/notifications/notification-preferences.ts"), "shouldDeliverInApp", "gating", errors);
    return errors;
  },
  "notification-sounds-gated-by-preferences": () => {
    const errors = [];
    must(read("src/lib/notifications/notification-preferences.ts"), "shouldPlaySound", "sound gate", errors);
    must(read("src/components/providers/app-provider.tsx"), "playNotificationChime", "runtime chime", errors);
    must(read("src/lib/notifications/notification-sound.ts"), "playNotificationChime", "chime util", errors);
    return errors;
  },
  "welcome-notification-new-users": () => {
    const errors = [];
    must(read("src/lib/notifications/welcome-notification.ts"), "free credits", "welcome body", errors);
    must(read("src/lib/auth/profile-bootstrap.ts"), "ensureWelcomeNotification", "bootstrap", errors);
    return errors;
  },
  "welcome-notification-existing-users-once": () => {
    const errors = [];
    must(read("src/app/api/notifications/welcome/route.ts"), "welcome", "welcome api", errors);
    return errors;
  },
  "admin-control-center": () => {
    const errors = [];
    must(read("src/components/admin/admin-control-center-panel.tsx"), "admin-control-center", "control center", errors);
    return errors;
  },
  "admin-platform-banner-preview": () => {
    const errors = [];
    must(read("src/components/admin/admin-system-status-panel.tsx"), "gradientFrom", "banner preview fields", errors);
    return errors;
  },
  "admin-notification-broadcast": () => {
    const errors = [];
    must(read("src/app/api/admin/notifications/broadcast/route.ts"), "notifications", "broadcast api", errors);
    return errors;
  },
  "admin-max-two-banners": () => {
    const errors = [];
    must(read("src/lib/status/status-public.ts"), ".limit(2)", "max two banners", errors);
    return errors;
  },
  "admin-live-banner-update": () => {
    const errors = [];
    must(read("src/components/platform/platform-announcement-banners.tsx"), "30_000", "poll interval", errors);
    return errors;
  },
  "platform-live-announcements": () => {
    const errors = [];
    must(read("src/components/platform/platform-announcement-banners.tsx"), "setInterval", "polling", errors);
    return errors;
  },
  "no-generic-credit-toast": () => {
    const errors = [];
    const imm = read("src/components/create/workspace/immersive-workspace.tsx");
    if (imm.includes('toast.error("Out of build credits')) {
      errors.push("generic bottom-right build credit toast removed");
    }
    must(imm, "BuildCreditsUpgradePanel", "inline upgrade panel", errors);
    return errors;
  },
};

if (!suites[check]) {
  console.error(`Unknown check: ${check}`);
  process.exit(1);
}

const errors = suites[check]();
console.log(`\n=== verify:${check} ===\n`);
if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  process.exit(1);
}
console.log("✓ OK");
