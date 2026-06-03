import type { TemplateSourceFile } from "@/lib/templates/template-source-types";

export type MobileBaselineInput = {
  appName: string;
  appId: string;
  themeColor?: string;
  description?: string;
};

/** Files every Vodex-generated app should include for PWA + Capacitor readiness. */
export function getGeneratedMobileBaselineFiles(input: MobileBaselineInput): TemplateSourceFile[] {
  const name = input.appName.trim() || "Vodex App";
  const short = name.slice(0, 12);
  const theme = input.themeColor?.trim() || "#2563eb";
  const appId = input.appId.replace(/[^a-z0-9.]/gi, "").toLowerCase() || "dev.vodex.app";

  return [
    {
      path: "public/manifest.webmanifest",
      content: JSON.stringify(
        {
          name,
          short_name: short,
          description: input.description ?? `${name} — built with Vodex`,
          start_url: "/",
          display: "standalone",
          background_color: "#0f172a",
          theme_color: theme,
          orientation: "portrait-primary",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "/icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        null,
        2,
      ),
    },
    {
      path: "public/icons/README.md",
      content: `# App icons\n\nReplace with 192px and 512px PNGs before store submission. Vodex preview uses placeholders.\n`,
    },
    {
      path: "styles/mobile-safe.css",
      content: `/* Vodex mobile baseline — safe areas, touch targets, overflow guard */
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
}

html, body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  padding-top: var(--sat);
  padding-right: var(--sar);
  padding-bottom: var(--sab);
  padding-left: var(--sal);
}

.vodex-mobile-shell {
  min-height: 100dvh;
  min-height: -webkit-fill-available;
}

button, a[role="button"], .btn {
  min-height: 44px;
  min-width: 44px;
}

@media (max-width: 640px) {
  main {
    padding-left: max(1rem, var(--sal));
    padding-right: max(1rem, var(--sar));
  }
}
`,
    },
    {
      path: "components/mobile-shell.tsx",
      content: `"use client";

import "@/styles/mobile-safe.css";

export function MobileShell({ children }: { children: React.ReactNode }) {
  return <div className="vodex-mobile-shell">{children}</div>;
}
`,
    },
    {
      path: "capacitor.config.ts",
      content: `import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "${appId}",
  appName: "${name.replace(/"/g, '\\"')}",
  webDir: "out",
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchShowDuration: 2000, backgroundColor: "${theme}" },
  },
};

export default config;
`,
    },
    {
      path: "README.mobile.md",
      content: `# ${name} — Mobile (Capacitor)

Capacitor is **free**. Vodex prepared this project for wrapping.

## Checklist

1. \`npm run build\` — produce static output in \`out/\` or \`dist/\`
2. \`npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios\`
3. \`npx cap sync\`
4. Android: \`npx cap open android\` (Android Studio)
5. iOS: \`npx cap open ios\` (Xcode, macOS only)

## Package ID

\`${appId}\`

## Secrets

Configure integrations in the Vodex app dashboard → Secrets. Never commit API keys.

## Offline shell

Service worker / offline fallback can be added in a later Vodex edit.
`,
    },
    {
      path: "lib/vodex-runtime-scope.ts",
      content: `/** Server-only — never import in client components with secrets. */
export const VODEX_PROJECT_ID = process.env.VODEX_PROJECT_ID ?? "";
export const VODEX_RUNTIME_SCOPE = "project";

export function assertServerProjectScope(projectId: string): void {
  if (!projectId) throw new Error("Missing project scope");
  if (typeof window !== "undefined") {
    throw new Error("Project scope checks must run on the server");
  }
}
`,
    },
  ];
}

export function mergeMobileBaselineIntoFiles(
  files: Array<{ path: string; content: string }>,
  input: MobileBaselineInput,
): Array<{ path: string; content: string }> {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  for (const f of getGeneratedMobileBaselineFiles(input)) {
    if (!byPath.has(f.path)) byPath.set(f.path, f.content);
  }
  if (byPath.has("app/layout.tsx")) {
    const layout = byPath.get("app/layout.tsx")!;
    if (!layout.includes("viewport")) {
      byPath.set(
        "app/layout.tsx",
        layout.replace(
          "export const metadata",
          `export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };\n\nexport const metadata`,
        ),
      );
    }
    if (!layout.includes("manifest")) {
      byPath.set(
        "app/layout.tsx",
        byPath.get("app/layout.tsx")!.replace(
          "</head>",
          '  <link rel="manifest" href="/manifest.webmanifest" />\n      </head>',
        ),
      );
    }
  }
  return Array.from(byPath.entries()).map(([path, content]) => ({ path, content }));
}
