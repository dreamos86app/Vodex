import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authEnabled,
  isAuthSystemRoute,
  type AppAuthSettings,
} from "@/lib/publish/default-auth-pages";
import { mergePreviewIframeEmbedHeaders } from "@/lib/preview/preview-iframe-embed-headers";

type AuthPageKind = "login" | "signup" | "forgot" | "callback";

function pageKind(route: string): AuthPageKind {
  const r = route.toLowerCase();
  if (r.includes("signup") || r.includes("sign-up") || r.includes("register")) return "signup";
  if (r.includes("forgot") || r.includes("reset")) return "forgot";
  if (r.includes("callback")) return "callback";
  return "login";
}

export function buildPreviewAuthPageHtml(input: {
  appName: string;
  iconUrl?: string | null;
  route: string;
  settings: AppAuthSettings;
}): string {
  const kind = pageKind(input.route);
  const title =
    kind === "signup"
      ? "Create account"
      : kind === "forgot"
        ? "Reset password"
        : kind === "callback"
          ? "Signing in…"
          : "Sign in";

  const providers: string[] = [];
  if (input.settings.google_enabled) providers.push("google");
  if (input.settings.github_enabled) providers.push("github");
  if (input.settings.apple_enabled) providers.push("apple");
  if (input.settings.microsoft_enabled) providers.push("microsoft");
  if (input.settings.facebook_enabled) providers.push("facebook");

  const oauthBtns = providers
    .map(
      (p) =>
        `<button type="button" class="oauth" data-provider="${p}" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:8px">Continue with ${p.charAt(0).toUpperCase() + p.slice(1)}</button>`,
    )
    .join("");

  const emailForm =
    input.settings.email_password_enabled && kind !== "callback"
      ? `<form id="vx-preview-auth-form" style="margin-top:16px">
          <div id="vx-error" style="display:none;margin-bottom:8px;padding:10px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px"></div>
          <input type="email" name="email" placeholder="Email" required autocomplete="email" style="width:100%;padding:11px 14px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:8px;font-size:14px" />
          ${kind !== "forgot" ? `<input type="password" name="password" placeholder="Password" required style="width:100%;padding:11px 14px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:8px;font-size:14px" />` : ""}
          <button type="submit" style="width:100%;padding:12px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-weight:600;font-size:14px;cursor:pointer">${kind === "forgot" ? "Send reset link" : kind === "signup" ? "Create account" : "Sign in"}</button>
        </form>`
      : "";

  const icon = input.iconUrl
    ? `<img src="${input.iconUrl}" alt="" width="56" height="56" style="width:56px;height:56px;border-radius:14px;object-fit:cover" />`
    : `<div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:22px">${input.appName.charAt(0).toUpperCase()}</div>`;

  const runtimeScript = `<script id="vodex-preview-auth-runtime">
(function(){
  var mockUser={id:"preview-user",email:"preview@vodex.dev",user_metadata:{full_name:"Preview User"}};
  function finish(){
    try{localStorage.setItem("sb-preview-auth","1");localStorage.setItem("vodex-preview-session",JSON.stringify(mockUser));}catch(e){}
    try{window.parent.postMessage({type:"vodex:navigate",path:"/"},"*");}catch(e){}
    try{window.__VODEX_VIRTUAL_PATH__="/";history.replaceState({__vodex:"/"},"","/");window.dispatchEvent(new PopStateEvent("popstate"));}catch(e){}
    location.replace("/");
  }
  document.querySelectorAll(".oauth").forEach(function(btn){
    btn.addEventListener("click",function(){finish();});
  });
  var form=document.getElementById("vx-preview-auth-form");
  if(form){
    form.addEventListener("submit",function(e){e.preventDefault();finish();});
  }
  if(${JSON.stringify(kind)}==="callback"){finish();}
})();
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} · ${input.appName}</title>
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}main{max-width:400px;width:100%;background:#fff;border-radius:20px;padding:32px;box-shadow:0 4px 24px rgba(15,23,42,.08)}h1{font-size:22px;margin:12px 0 4px}p.sub{color:#64748b;font-size:14px;margin:0 0 20px}</style>
</head>
<body>
<main>
<div style="display:flex;flex-direction:column;align-items:center;text-align:center">${icon}<h1>${title}</h1><p class="sub">${input.appName} · Preview sign-in</p></div>
${oauthBtns}
${emailForm}
<p style="margin-top:20px;font-size:12px;color:#94a3b8;text-align:center">Preview mode — auth is simulated. Configure real providers before publishing.</p>
</main>
${runtimeScript}
</body>
</html>`;
}

export async function resolvePreviewAuthPageHtml(
  admin: SupabaseClient,
  projectId: string,
  route: string,
  projectMeta?: Record<string, unknown>,
  projectName?: string | null,
): Promise<string | null> {
  if (!isAuthSystemRoute(route)) return null;

  const { data: authRow } = await admin
    .from("app_auth_provider_settings" as never)
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const settings = (authRow ?? {
    email_password_enabled: true,
    google_enabled: false,
    github_enabled: false,
    apple_enabled: false,
    oauth_mode: "vodex_managed",
  }) as AppAuthSettings;

  if (!authEnabled(settings)) return null;

  const iconPath =
    projectMeta && typeof projectMeta.icon_path === "string" ? projectMeta.icon_path : null;

  return buildPreviewAuthPageHtml({
    appName: projectName ?? "App",
    iconUrl: iconPath,
    route,
    settings,
  });
}

export function previewAuthHtmlHeaders(): Record<string, string> {
  return mergePreviewIframeEmbedHeaders({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Preview-Renderable": "true",
  });
}
