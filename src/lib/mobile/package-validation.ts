const ANDROID_PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const IOS_BUNDLE = /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*)+$/;

export function validateAndroidPackageId(value: string | null | undefined): {
  valid: boolean;
  message?: string;
} {
  const v = value?.trim() ?? "";
  if (!v) return { valid: false, message: "Package ID is required (e.g. com.company.appname)" };
  if (!ANDROID_PACKAGE.test(v)) {
    return {
      valid: false,
      message: "Use lowercase segments separated by dots, starting with a letter (com.company.app)",
    };
  }
  if (v.split(".").length < 2) {
    return { valid: false, message: "Package ID needs at least two segments (com.appname)" };
  }
  return { valid: true };
}

export function validateIosBundleId(value: string | null | undefined): {
  valid: boolean;
  message?: string;
} {
  const v = value?.trim() ?? "";
  if (!v) return { valid: false, message: "Bundle ID is required (e.g. com.company.appname)" };
  if (!IOS_BUNDLE.test(v)) {
    return {
      valid: false,
      message: "Use reverse-domain format with letters, numbers, hyphens, and dots",
    };
  }
  return { valid: true };
}

export function validateVersionName(value: string | null | undefined): boolean {
  return /^\d+\.\d+\.\d+([-.][\w\d]+)?$/.test(value?.trim() ?? "");
}

/** Reverse-domain app id on vodex.app — never dreamos86 / dreamos legacy domains. */
export function suggestPackageId(appName: string): string {
  const slug = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return `com.vodex.${slug || "myapp"}`;
}

export function migrateLegacyPackageId(
  value: string | null | undefined,
  appName: string,
): string {
  const v = value?.trim() ?? "";
  if (!v || /\.dreamos(\.|$)/i.test(v) || v.includes("dreamos86")) {
    return suggestPackageId(appName);
  }
  return v;
}
