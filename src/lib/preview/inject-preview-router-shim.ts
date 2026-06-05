/**
 * SPAs using BrowserRouter read `window.location.pathname`. Inside our preview iframe
 * that path is `/api/projects/.../preview-html`, which breaks routing. Normalize to the
 * app's route (from `?route=`) before the bundle boots.
 */
export function injectPreviewRouterShim(html: string, routePath: string): string {
  const route = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const script = `<script id="vodex-preview-router-shim">(function(){try{var p=${JSON.stringify(route)};if(window.history&&window.history.replaceState){window.history.replaceState(null,"",p);}}catch(e){}})();</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
