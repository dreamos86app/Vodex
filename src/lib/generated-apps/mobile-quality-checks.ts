export type MobileCheckResult = {
  id: string;
  pass: boolean;
  message: string;
};

export function runGeneratedMobileQualityChecks(files: Array<{ path: string; content: string }>): MobileCheckResult[] {
  const all = files.map((f) => `${f.path}\n${f.content}`).join("\n");
  const paths = new Set(files.map((f) => f.path));

  return [
    {
      id: "mobile_viewport",
      pass: /viewportFit|viewport|device-width/i.test(all),
      message: "Viewport meta / export present",
    },
    {
      id: "safe_area",
      pass: /safe-area-inset|env\(safe-area/i.test(all),
      message: "Safe-area CSS variables",
    },
    {
      id: "touch_targets",
      pass: /min-height:\s*44px|min-h-\[44px\]|min-h-11/i.test(all),
      message: "Touch-friendly minimum targets",
    },
    {
      id: "no_horizontal_overflow",
      pass: /overflow-x:\s*hidden|overflow-x-hidden/i.test(all),
      message: "Horizontal overflow guard",
    },
    {
      id: "pwa_manifest",
      pass: paths.has("public/manifest.webmanifest") || /manifest\.webmanifest/i.test(all),
      message: "Web app manifest",
    },
    {
      id: "capacitor_readiness",
      pass: paths.has("capacitor.config.ts") || /CapacitorConfig/i.test(all),
      message: "Capacitor config",
    },
  ];
}

export function mobileQualityPassCount(checks: MobileCheckResult[]): number {
  return checks.filter((c) => c.pass).length;
}
