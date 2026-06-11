/** Inject project + preview-runtime base for asset proxy, Ripo lookups, and auth redirects. */

import { buildPreviewRuntimeAuthUrlBootstrapScript } from "@/lib/preview/preview-runtime-auth-url-script";

export function buildPreviewProjectContextScript(
  projectId: string,
  artifactId: string,
): string {
  return `${buildPreviewRuntimeAuthUrlBootstrapScript(projectId, artifactId)}
(function(){
  window.__VODEX_PROJECT_ID__=${JSON.stringify(projectId)};
  window.__VODEX_ARTIFACT_ID__=${JSON.stringify(artifactId)};
})();`;
}

export function injectPreviewProjectContext(
  html: string,
  projectId: string,
  artifactId: string,
): string {
  if (html.includes("vodex-preview-project-context")) return html;
  const script = `<script id="vodex-preview-project-context" data-vodex-preview-shim="true">${buildPreviewProjectContextScript(projectId, artifactId)}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
