export function injectPreviewEnvShims(html, legacy) {
    if (!legacy.base44 && !legacy.lovable)
        return html;
    const shim = `<script>
(function(){
  var g = typeof globalThis !== 'undefined' ? globalThis : window;
  if (!g.__VODEX_PREVIEW__) g.__VODEX_PREVIEW__ = true;
  if (${legacy.base44}) {
    g.process = g.process || { env: {} };
    g.process.env.VITE_BASE44_APP_ID = g.process.env.VITE_BASE44_APP_ID || 'preview-mock';
    g.process.env.VITE_BASE44_API_URL = g.process.env.VITE_BASE44_API_URL || 'https://preview.invalid';
    g.__BASE44_PREVIEW_MOCK__ = true;
    if (typeof fetch === 'function' && !g.__VODEX_BASE44_FETCH__) {
      g.__VODEX_BASE44_FETCH__ = true;
      var realFetch = fetch.bind(g);
      g.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/base44/i.test(url)) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, preview: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return realFetch(input, init);
      };
    }
  }
  if (${legacy.lovable}) {
    g.process = g.process || { env: {} };
    g.process.env.VITE_SUPABASE_URL = g.process.env.VITE_SUPABASE_URL || 'https://preview.invalid';
    g.process.env.VITE_SUPABASE_ANON_KEY = g.process.env.VITE_SUPABASE_ANON_KEY || 'preview-anon-key';
  }
})();
</script>`;
    if (html.includes("</head>"))
        return html.replace("</head>", `${shim}</head>`);
    if (html.includes("<body"))
        return html.replace(/<body[^>]*>/i, (m) => `${m}${shim}`);
    return shim + html;
}
export function detectLegacy(files) {
    const blob = files.map((f) => f.content).join("\n");
    return {
        base44: /@base44\/|BASE44_/i.test(blob),
        lovable: /lovable\.dev|VITE_SUPABASE_URL/i.test(blob),
    };
}
