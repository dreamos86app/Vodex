/** Remove Base44 / legacy platform badges from published HTML when safe. */
export function stripLegacyPlatformBadges(html: string): string {
  let out = html;

  out = out.replace(
    /<a[^>]*data-dreamos-branding[^>]*>[\s\S]*?<\/a>/gi,
    "",
  );
  out = out.replace(
    /<footer[^>]*data-dreamos-branding[^>]*>[\s\S]*?<\/footer>/gi,
    "",
  );
  out = out.replace(/<[^>]*(?:base44|edit with base44|built with base44)[^>]*>[\s\S]*?<\/[^>]+>/gi, "");
  out = out.replace(/Built with Base44/gi, "");
  out = out.replace(/Edit with Base44/gi, "");
  out = out.replace(/data-base44-branding/gi, "data-removed-branding");

  out = out.replace(/https?:\/\/[^"'\s]*base44\.app[^"'\s]*/gi, "");
  out = out.replace(/https?:\/\/[^"'\s]*base44\.io[^"'\s]*/gi, "");
  out = out.replace(/VITE_BASE44_APP_BASE_URL/g, "VODEX_APP_BASE_URL");

  return out;
}
