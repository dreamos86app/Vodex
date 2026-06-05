/** Client-side: navigate preview iframe without changing src URL. */
export function navigatePreviewIframe(iframe: HTMLIFrameElement | null, path: string): void {
  if (!iframe?.contentWindow) return;
  const route = path.startsWith("/") ? path : `/${path}`;
  iframe.contentWindow.postMessage({ type: "vodex:navigate", path: route }, "*");
}
