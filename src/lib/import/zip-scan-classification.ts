/**
 * ZIP scan blocker classification — web preview vs config vs mobile packaging.
 */

export type ZipScanBlockerCategory = "web_preview" | "configuration" | "mobile_packaging";

export type ZipScanBlocker = {
  code: string;
  message: string;
  category: ZipScanBlockerCategory;
};

const MOBILE_PACKAGING_RE =
  /\b(android package|package id|version code|sha-?1|sha-?256|bundle id|app store|play store|keystore|signing key)\b/i;

export function classifyZipBlocker(message: string): ZipScanBlockerCategory {
  if (MOBILE_PACKAGING_RE.test(message)) return "mobile_packaging";
  if (
    /\b(secret|api key|env|supabase|database url|missing key|credentials)\b/i.test(message)
  ) {
    return "configuration";
  }
  return "web_preview";
}

export function splitZipScanBlockers(messages: string[]): {
  webPreviewBlockers: ZipScanBlocker[];
  configurationNeeded: ZipScanBlocker[];
  mobilePackagingLater: ZipScanBlocker[];
} {
  const webPreviewBlockers: ZipScanBlocker[] = [];
  const configurationNeeded: ZipScanBlocker[] = [];
  const mobilePackagingLater: ZipScanBlocker[] = [];

  for (const message of messages) {
    const category = classifyZipBlocker(message);
    const item: ZipScanBlocker = {
      code: message.slice(0, 48).replace(/\W+/g, "_").toLowerCase(),
      message,
      category,
    };
    if (category === "mobile_packaging") mobilePackagingLater.push(item);
    else if (category === "configuration") configurationNeeded.push(item);
    else webPreviewBlockers.push(item);
  }

  return { webPreviewBlockers, configurationNeeded, mobilePackagingLater };
}

export function webPreviewReady(
  webBlockers: ZipScanBlocker[],
  hasEntry: boolean,
): boolean {
  return hasEntry && webBlockers.length === 0;
}
