import fs from "node:fs";
import path from "node:path";

export function createChecker(root) {
  const errors = [];
  const must = (rel, needle, label) => {
    const p = path.join(root, rel);
    if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
  };
  const mustNot = (rel, needle, label) => {
    const p = path.join(root, rel);
    if (fs.existsSync(p) && fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
  };
  const mustExist = (rel, label) => {
    if (!fs.existsSync(path.join(root, rel))) errors.push(label);
  };
  return { errors, must, mustNot, mustExist };
}

export const CHECKS = {
  "published-app-runtime": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    mustExist("src/lib/publish/published-app-runtime.ts", "published-app-runtime.ts");
    must("src/lib/publish/published-app-runtime.ts", "resolvePublishedAppHtml", "html resolver");
    must("src/lib/publish/published-app-runtime.ts", "probePublishedAppHealth", "health probe");
    must("src/lib/publish/published-app-runtime.ts", "loadPublishedAppBySlug", "slug loader");
    mustExist("src/app/api/public/[slug]/health/route.ts", "health route");
    mustExist("src/app/api/public/[slug]/assets/[...path]/route.ts", "assets route");
    must("src/app/p/[slug]/[[...path]]/route.ts", "resolvePublishedAppHtml", "direct HTML route");
    return errors;
  },
  "published-spa-routing": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/rewrite-published-artifact-html.ts", "injectPreviewRouterShim", "SPA router shim");
    must("src/lib/publish/published-app-runtime.ts", "normalizePublishedRoute", "route normalizer");
    must("src/proxy.ts", "slugFromSubdomainHost", "subdomain proxy routing");
    return errors;
  },
  "preview-page-switching": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/preview/preview-route-navigation.ts", "vodex:navigate", "postMessage navigate");
    must("src/lib/preview/inject-preview-route-listener.ts", "vodex:navigate", "route listener");
    must("src/components/create/workspace/preview-panel.tsx", "navigatePreviewIframe", "preview panel postMessage");
    return errors;
  },
  "device-preview-no-reload": (root) => {
    const { errors, must, mustNot } = createChecker(root);
    must("src/components/create/workspace/preview-panel.tsx", "key={reloadKey}", "viewport does not remount iframe");
    mustNot("src/components/create/workspace/preview-panel.tsx", "key={`${viewport}-${reloadKey}`}", "no viewport in iframe key");
    return errors;
  },
  "device-preview-no-refresh": (root) => {
    return CHECKS["device-preview-no-reload"](root);
  },
  "clean-publish-domains": (root) => {
    const { errors, must, mustNot } = createChecker(root);
    must("src/lib/publish/subdomain-allocator.ts", "collisionSuffixes", "collision suffix strategy");
    mustNot("src/lib/publish/subdomain-allocator.ts", "Math.random()", "no random slug suffix");
    must("src/lib/publish/publish-config.ts", "vodex.app", "vodex.app default domain");
    return errors;
  },
  "custom-domains": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    mustExist("supabase/migrations/20260819120000_p42_published_runtime.sql", "custom_domains migration");
    mustExist("src/app/api/projects/[id]/custom-domains/route.ts", "custom domains API");
    mustExist("src/components/publish/custom-domains-panel.tsx", "custom domains panel");
    must("src/components/publish/custom-domains-panel.tsx", "Verify DNS", "verify button");
    return errors;
  },
  "auth-settings": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    mustExist("src/components/settings/app-auth-settings-panel.tsx", "auth settings panel");
    must("src/components/settings/app-auth-settings-panel.tsx", "Vodex-managed OAuth", "vodex managed oauth");
    mustExist("src/app/api/projects/[id]/auth-settings/route.ts", "auth settings API");
    return errors;
  },
  "no-base44-branding": (root) => {
    const { errors, mustNot } = createChecker(root);
    const uiDirs = ["src/components/settings", "src/components/create/workspace/app-dashboard-panel.tsx"];
    for (const rel of uiDirs) {
      const p = path.join(root, rel);
      if (!fs.existsSync(p)) continue;
      const scan = (file) => {
        const c = fs.readFileSync(file, "utf8");
        if (/Use default Base44 OAuth/i.test(c)) errors.push(`Base44 OAuth copy in ${file}`);
        if (/Edit with Base44/i.test(c)) errors.push(`Base44 badge in ${file}`);
      };
      if (fs.statSync(p).isDirectory()) {
        for (const f of fs.readdirSync(p, { recursive: true })) {
          if (String(f).endsWith(".tsx")) scan(path.join(p, String(f)));
        }
      } else scan(p);
    }
    return errors;
  },
  "supabase-auth-domain-config": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/supabase/auth-domain.ts", "VODEX_SUPABASE_AUTH_DOMAIN_READY", "auth domain env");
    must("src/lib/publish/publish-config.ts", "vodexSupabaseAuthDomainReady", "publish config flag");
    return errors;
  },
  "github-integration-flow": (root) => {
    const { errors, mustExist } = createChecker(root);
    mustExist("src/app/api/integrations/github/callback/route.ts", "github callback");
    mustExist("src/app/api/projects/[id]/integrations/github/oauth/start/route.ts", "github oauth start");
    return errors;
  },
  "supabase-integration-flow": (root) => {
    const { errors, mustExist } = createChecker(root);
    mustExist("src/app/api/projects/[id]/integrations/supabase/connect/route.ts", "supabase connect");
    mustExist("src/app/api/projects/[id]/integrations/supabase/test/route.ts", "supabase test");
    return errors;
  },
  "integration-secret-wizard": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    must("src/components/integrations/integrations-catalog-panel.tsx", "Connect", "connect CTA");
    mustExist("src/components/integrations/app-project-secrets-panel.tsx", "secrets wizard panel");
    must("src/components/integrations/app-project-secrets-panel.tsx", "Save", "save with validation");
    return errors;
  },
  "square-app-icons": (root) => {
    const { errors, must } = createChecker(root);
    must("src/components/projects/project-icon.tsx", "circular = false", "square default icons");
    must("src/components/projects/project-icon.tsx", "rounded-xl", "square rounded card");
    return errors;
  },
  "share-icons": (root) => {
    const { errors, must, mustNot } = createChecker(root);
    must("src/components/publish/platform-share-icons.tsx", "PlatformShareButton", "share button component");
    must("src/components/publish/publish-success-panel.tsx", "PlatformShareButton", "success panel icons");
    mustNot("src/components/publish/publish-success-panel.tsx", "label.slice(0, 1)", "no letter placeholders");
    return errors;
  },
  "watermark-runtime": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/watermark-runtime.ts", "injectPublishedWatermark", "watermark injector");
    must("src/lib/publish/watermark-runtime.ts", "Made with Vodex", "page footer copy");
    must("src/lib/publish/watermark-runtime.ts", "vodex-page-watermark", "document flow footer");
    must("src/lib/publish/published-app-runtime.ts", "injectPublishedWatermark", "runtime watermark");
    return errors;
  },
  "watermark-entitlements": (root) => {
    const { errors, must, mustNot } = createChecker(root);
    must("src/lib/publish/watermark-runtime.ts", "shouldInjectPublishedWatermark", "entitlement gate");
    must("src/lib/publish/watermark-runtime.ts", 'planTier === "free"', "free always watermarked");
    mustNot("src/lib/publish/watermark-runtime.ts", "position:fixed;bottom:0", "no fixed screen footer");
    return errors;
  },
  "publish-success-ux": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    must("src/components/publish/publish-success-panel.tsx", "publish-success-panel", "success panel");
    must("src/components/publish/publish-success-panel.tsx", "Open live app", "open CTA");
    must("src/components/publish/publish-success-panel.tsx", "QrCode", "QR CTA");
    mustExist("src/components/publish/publish-success-overlay.tsx", "success overlay");
    mustExist("src/components/publish/publish-confetti.tsx", "confetti");
    return errors;
  },
  "app-dashboard-settings": (root) => {
    const { errors, must } = createChecker(root);
    must("src/components/create/workspace/app-dashboard-panel.tsx", "DashboardDomainsSection", "domains section");
    must("src/components/create/workspace/app-dashboard-panel.tsx", "AppAuthSettingsPanel", "auth section");
    must("src/components/create/workspace/app-dashboard-panel.tsx", "IntegrationsCatalogPanel", "integrations");
    return errors;
  },
  "template-marketplace": (root) => {
    const { errors, mustExist } = createChecker(root);
    mustExist("src/components/templates/templates-view.tsx", "templates view");
    mustExist("src/app/api/templates/community/route.ts", "community API");
    mustExist("supabase/migrations/20260819120000_p42_published_runtime.sql", "template_votes");
    return errors;
  },
  "mobile-studio-production": (root) => {
    const { errors, must } = createChecker(root);
    must("src/components/mobile/mobile-wrapper-studio.tsx", "Play Console", "play store guidance");
    must("src/lib/mobile/mobile-build-pipeline.ts", "buildSuccess: false", "honest build success");
    return errors;
  },
  "brand-cleanup": (root) => {
    const { errors, mustNot } = createChecker(root);
    mustNot("src/lib/mobile/package-validation.ts", "com.dreamos", "no com.dreamos package");
    const components = path.join(root, "src/components");
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(fp);
        else if (ent.name.endsWith(".tsx")) {
          const c = fs.readFileSync(fp, "utf8");
          if (/dreamos86/i.test(c)) errors.push(`dreamos86 in ${fp}`);
        }
      }
    };
    walk(components);
    return errors;
  },
  "no-dreamos-branding": (root) => CHECKS["brand-cleanup"](root),
};
