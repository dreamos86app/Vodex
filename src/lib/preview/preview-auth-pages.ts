import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authEnabled,
  isAuthSystemRoute,
  type AppAuthSettings,
} from "@/lib/publish/default-auth-pages";
import { mergePreviewIframeEmbedHeaders } from "@/lib/preview/preview-iframe-embed-headers";
import { resolvePreviewAppIconUrl } from "@/lib/preview/resolve-preview-app-icon-url";
import { buildPreviewRuntimeAuthUrlBootstrapScript } from "@/lib/preview/preview-runtime-auth-url-script";
import {
  previewOAuthProviderIconHtml,
  previewOAuthProviderLabel,
} from "@/lib/preview/preview-oauth-provider-icons";
import {
  resolvePreviewPostAuthRoute,
  routesFromProjectMetadata,
} from "@/lib/preview/route-discovery";

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
  iconUrl: string;
  route: string;
  settings: AppAuthSettings;
  projectId: string;
  artifactId: string;
  postAuthRoute: string;
}): string {
  const kind = pageKind(input.route);
  const initialView =
    kind === "signup" ? "signup" : kind === "forgot" ? "forgot" : kind === "callback" ? "callback" : "login";

  const providers: string[] = [];
  if (input.settings.google_enabled) providers.push("google");
  if (input.settings.github_enabled) providers.push("github");
  if (input.settings.apple_enabled) providers.push("apple");
  if (input.settings.microsoft_enabled) providers.push("microsoft");
  if (input.settings.facebook_enabled) providers.push("facebook");

  const icon = `<img src="${input.iconUrl}" alt="" class="brand-icon" onerror="this.style.display='none';this.nextElementSibling&&this.nextElementSibling.classList.add('show');" /><div class="brand-fallback">${input.appName.charAt(0).toUpperCase()}</div>`;

  const oauthProvidersJson = JSON.stringify(providers);
  const emailEnabled = input.settings.email_password_enabled;

  const oauthIconsJson = JSON.stringify(
    Object.fromEntries(providers.map((p) => [p, previewOAuthProviderIconHtml(p)])),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Sign in · ${input.appName}</title>
<script id="vodex-preview-auth-bootstrap">${buildPreviewRuntimeAuthUrlBootstrapScript(input.projectId, input.artifactId)}</script>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#ffffff;--surface:#f8fafc;--text:#0f172a;--muted:#64748b;
  --accent:#1e6bff;--accent-hover:#1558d6;--accent-soft:rgba(30,107,255,.1);
  --border:#e2e8f0;--danger:#dc2626;--ok:#16a34a;
  --radius:16px;--font:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  --shadow:0 4px 24px rgba(15,23,42,.06),0 1px 3px rgba(15,23,42,.04);
}
html,body{margin:0;min-height:100%;font-family:var(--font);color:var(--text);background:var(--bg)}
body{
  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;
  background:
    radial-gradient(ellipse 90% 60% at 50% -20%,rgba(30,107,255,.08),transparent 60%),
    linear-gradient(180deg,#f8fafc 0%,#ffffff 45%);
}
.shell{width:100%;max-width:420px}
.card{
  border-radius:calc(var(--radius) + 2px);padding:32px 28px 24px;
  background:var(--bg);border:1px solid var(--border);box-shadow:var(--shadow);
}
.brand{display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:22px}
.brand-icon,.brand-fallback{width:72px;height:72px;border-radius:12px}
.brand-icon{object-fit:contain;background:#fff;border:1px solid var(--border);box-shadow:0 8px 20px rgba(15,23,42,.08)}
.brand-fallback{
  display:none;align-items:center;justify-content:center;font-weight:800;font-size:28px;
  background:linear-gradient(135deg,var(--accent),#4d8dff);color:#fff;
  box-shadow:0 8px 24px rgba(30,107,255,.25);
}
.brand-fallback.show{display:flex}
h1{font-size:1.45rem;font-weight:700;margin:14px 0 4px;letter-spacing:-.02em;color:var(--text)}
.sub{color:var(--muted);font-size:.9rem;margin:0;line-height:1.5}
.view{display:none;animation:fadeIn .22s ease}
.view.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.oauth-grid{display:flex;flex-direction:column;gap:10px;margin-top:18px}
.oauth{
  display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:11px 14px;
  border-radius:12px;border:1px solid var(--border);background:var(--bg);
  color:var(--text);font-size:.88rem;font-weight:600;cursor:pointer;
  transition:border-color .15s,background .15s,box-shadow .15s;
}
.oauth:hover{border-color:#cbd5e1;background:var(--surface);box-shadow:0 2px 8px rgba(15,23,42,.04)}
.oauth-icon{flex-shrink:0;display:block}
.divider{display:flex;align-items:center;gap:12px;margin:18px 0;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;font-weight:600}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--border)}
.field{margin-bottom:12px}
.field label{display:block;font-size:.78rem;font-weight:600;color:var(--text);margin-bottom:6px}
.field input{
  width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--border);
  background:var(--surface);color:var(--text);font-size:.92rem;outline:none;
  transition:border-color .15s,box-shadow .15s;
}
.field input:focus{border-color:rgba(30,107,255,.55);box-shadow:0 0 0 3px rgba(30,107,255,.14)}
.btn-primary{
  width:100%;padding:12px;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:.92rem;
  color:#fff;background:var(--accent);margin-top:4px;
  transition:background .15s,transform .12s,box-shadow .15s;
  box-shadow:0 4px 14px rgba(30,107,255,.28);
}
.btn-primary:hover{background:var(--accent-hover);box-shadow:0 6px 18px rgba(30,107,255,.32)}
.btn-primary:active{transform:scale(.99)}
.btn-primary.loading{opacity:.85;pointer-events:none;position:relative;color:transparent}
.btn-primary.loading::after{
  content:"";position:absolute;inset:0;margin:auto;width:20px;height:20px;
  border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;
  animation:vxSpin .65s linear infinite;
}
@keyframes vxSpin{to{transform:rotate(360deg)}}
.loading-overlay{
  display:none;position:fixed;inset:0;z-index:9999;background:rgba(255,255,255,.72);
  backdrop-filter:blur(4px);align-items:center;justify-content:center;flex-direction:column;gap:12px;
}
.loading-overlay.show{display:flex}
.loading-spinner{width:36px;height:36px;border:3px solid rgba(30,107,255,.2);border-top-color:var(--accent);border-radius:50%;animation:vxSpin .65s linear infinite}
.loading-text{font-size:.9rem;font-weight:600;color:var(--text)}
.err{display:none;margin-bottom:12px;padding:10px 12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:.82rem}
.err.show{display:block}
.links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 16px;margin-top:16px;font-size:.82rem}
.links button.link{color:var(--muted);background:none;border:none;padding:0;cursor:pointer;font:inherit}
.links button.link:hover{color:var(--accent);text-decoration:underline}
.footnote{margin-top:20px;text-align:center;font-size:.72rem;color:var(--muted);line-height:1.5}
.success-icon{width:52px;height:52px;border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--ok);font-size:26px;font-weight:700}
</style>
</head>
<body>
<div id="vx-loading" class="loading-overlay" aria-live="polite">
  <div class="loading-spinner"></div>
  <p class="loading-text" id="vx-loading-msg">Signing you in…</p>
</div>
<div class="shell">
  <main class="card">
    <div class="brand">${icon}<h1 id="vx-title">Welcome back</h1><p class="sub" id="vx-sub">Sign in to continue to ${input.appName}</p></div>
    <div id="vx-error" class="err"></div>

    <section id="view-login" class="view ${initialView === "login" ? "active" : ""}">
      ${providers.length ? `<div class="oauth-grid" id="vx-oauth-login"></div>${emailEnabled ? '<div class="divider">or email</div>' : ""}` : ""}
      ${emailEnabled ? `<form id="form-login" novalidate>
        <div class="field"><label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required /></div>
        <div class="field"><label for="login-pass">Password</label><input id="login-pass" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required /></div>
        <button type="submit" class="btn-primary">Sign in</button>
      </form>` : `<button type="button" class="btn-primary" id="vx-guest-login">Continue to app</button>`}
      <div class="links">
        ${emailEnabled ? '<button type="button" class="link" data-go="forgot">Forgot password?</button>' : ""}
        <button type="button" class="link" data-go="signup">Create account</button>
      </div>
    </section>

    <section id="view-signup" class="view ${initialView === "signup" ? "active" : ""}">
      ${providers.length ? `<div class="oauth-grid" id="vx-oauth-signup"></div>${emailEnabled ? '<div class="divider">or email</div>' : ""}` : ""}
      ${emailEnabled ? `<form id="form-signup" novalidate>
        <div class="field"><label for="signup-name">Full name</label><input id="signup-name" name="name" type="text" autocomplete="name" placeholder="Alex Rivera" required /></div>
        <div class="field"><label for="signup-email">Email</label><input id="signup-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required /></div>
        <div class="field"><label for="signup-pass">Password</label><input id="signup-pass" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" minlength="8" required /></div>
        <button type="submit" class="btn-primary">Create account</button>
      </form>` : ""}
      <div class="links"><button type="button" class="link" data-go="login">Already have an account? Sign in</button></div>
    </section>

    <section id="view-forgot" class="view ${initialView === "forgot" ? "active" : ""}">
      <form id="form-forgot" novalidate>
        <div class="field"><label for="forgot-email">Email</label><input id="forgot-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required /></div>
        <button type="submit" class="btn-primary">Send reset link</button>
      </form>
      <div class="links"><button type="button" class="link" data-go="login">Back to sign in</button></div>
    </section>

    <section id="view-forgot-sent" class="view">
      <div class="success-icon">✓</div>
      <p class="sub" style="text-align:center">If an account exists for that email, we sent a reset link. Check your inbox.</p>
      <div class="links" style="margin-top:20px"><button type="button" class="link" data-go="login">Return to sign in</button></div>
    </section>

    <section id="view-callback" class="view ${initialView === "callback" ? "active" : ""}">
      <p class="sub" style="text-align:center">Completing sign-in…</p>
    </section>

    <p class="footnote">Preview mode — authentication is simulated. Configure real providers before publishing.</p>
  </main>
</div>
<script id="vodex-preview-auth-runtime">
(function(){
  var mockUser={id:"preview-user",email:"preview@vodex.dev",user_metadata:{full_name:"Preview User"}};
  var providers=${oauthProvidersJson};
  var oauthIcons=${oauthIconsJson};
  var oauthLabels=${JSON.stringify(Object.fromEntries(providers.map((p) => [p, previewOAuthProviderLabel(p)])))};
  var postAuthRoute=${JSON.stringify(input.postAuthRoute)};
  var titles={login:{h:"Welcome back",s:"Sign in to continue"},signup:{h:"Create your account",s:"Join in seconds"},forgot:{h:"Reset password",s:"We'll email you a secure link"},"forgot-sent":{h:"Check your email",s:"Reset link sent"},"callback":{h:"Signing in…",s:"One moment"}};
  function showErr(msg){var el=document.getElementById("vx-error");if(!el)return;el.textContent=msg;el.classList.add("show");setTimeout(function(){el.classList.remove("show");},5000);}
  function previewRuntimeBase(){
    if(typeof window.__vodexPreviewRuntimeBase==="function"){var b=window.__vodexPreviewRuntimeBase();if(b)return b;}
    try{
      var m=String(document.URL||location.href).match(/\\/preview-runtime\\/[^/?#]+\\/[^/?#]+/);
      if(m)return m[0];
    }catch(e){}
    return null;
  }
  function previewAppHomeUrl(){
    var base=previewRuntimeBase();
    return base?base+"/":null;
  }
  function showLoading(msg){
    var el=document.getElementById("vx-loading");
    var m=document.getElementById("vx-loading-msg");
    if(m&&msg)m.textContent=msg;
    if(el)el.classList.add("show");
    document.querySelectorAll(".btn-primary").forEach(function(b){b.classList.add("loading");b.disabled=true;});
  }
  function finish(user){
    var home=previewAppHomeUrl();
    if(!home){showErr("Could not return to the app preview.");return;}
    var u=user||mockUser;
    var route=postAuthRoute||"/";
    showLoading(route==="/"||route==="/home"||route==="/Home"?"Opening your app…":"Taking you to "+route+"…");
    try{localStorage.setItem("sb-preview-auth","1");localStorage.setItem("vodex-preview-session",JSON.stringify(u));}catch(e){}
    try{sessionStorage.setItem("vodex-preview-post-auth-route",route);}catch(e){}
    try{parent.postMessage({type:"vodex-preview-route",path:route},"*");}catch(e){}
    var sep=home.indexOf("?")>=0?"&":"?";
    setTimeout(function(){
      window.location.replace(home+sep+"route="+encodeURIComponent(route));
    },450);
  }
  function setView(name){
    document.querySelectorAll(".view").forEach(function(v){v.classList.remove("active");});
    var el=document.getElementById("view-"+name);
    if(el)el.classList.add("active");
    var t=titles[name]||titles.login;
    var h=document.getElementById("vx-title");var s=document.getElementById("vx-sub");
    if(h)h.textContent=t.h;if(s)s.textContent=t.s;
  }
  document.querySelectorAll("[data-go]").forEach(function(btn){
    btn.addEventListener("click",function(){setView(btn.getAttribute("data-go"));});
  });
  function oauthBtn(p){
    var b=document.createElement("button");
    b.type="button";b.className="oauth";b.dataset.provider=p;
    var icon=oauthIcons[p]||"";
    var label=oauthLabels[p]||(p.charAt(0).toUpperCase()+p.slice(1));
    b.innerHTML=icon+'<span>Continue with '+label+"</span>";
    b.addEventListener("click",function(){finish();});
    return b;
  }
  ["vx-oauth-login","vx-oauth-signup"].forEach(function(id){
    var root=document.getElementById(id);
    if(!root)return;
    providers.forEach(function(p){root.appendChild(oauthBtn(p));});
  });
  var guest=document.getElementById("vx-guest-login");
  if(guest)guest.addEventListener("click",function(){finish();});
  function bindForm(id,handler){
    var f=document.getElementById(id);
    if(!f)return;
    f.addEventListener("submit",function(e){e.preventDefault();handler(new FormData(f));});
  }
  bindForm("form-login",function(fd){
    if(!fd.get("email")||!fd.get("password")){showErr("Enter email and password.");return;}
    finish({id:"preview-user",email:String(fd.get("email")),user_metadata:{full_name:"Preview User"}});
  });
  bindForm("form-signup",function(fd){
    if(!fd.get("email")||!fd.get("password")){showErr("Complete all fields.");return;}
    finish({id:"preview-user",email:String(fd.get("email")),user_metadata:{full_name:String(fd.get("name")||"Preview User")}});
  });
  bindForm("form-forgot",function(){
    setView("forgot-sent");
  });
  if(${JSON.stringify(initialView)}==="callback"){finish();}
  else{setView(${JSON.stringify(initialView)});}
})();
</script>
</body>
</html>`;
}

export async function resolvePreviewAuthPageHtml(
  admin: SupabaseClient,
  projectId: string,
  artifactId: string,
  route: string,
  projectMeta?: Record<string, unknown>,
  projectName?: string | null,
  appName?: string | null,
  iconUrl?: string | null,
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
    microsoft_enabled: false,
    facebook_enabled: false,
    oauth_mode: "vodex_managed",
  }) as AppAuthSettings;

  if (!authEnabled(settings)) return null;

  const displayName = appName?.trim() || projectName?.trim() || "App";
  const resolvedIcon = resolvePreviewAppIconUrl({
    projectId,
    iconUrl,
    metadata: projectMeta,
  });

  const routePaths = routesFromProjectMetadata(projectMeta);
  const postAuthRoute = resolvePreviewPostAuthRoute(routePaths);

  return buildPreviewAuthPageHtml({
    appName: displayName,
    iconUrl: resolvedIcon,
    route,
    settings,
    projectId,
    artifactId,
    postAuthRoute,
  });
}

export function previewAuthHtmlHeaders(): Record<string, string> {
  return mergePreviewIframeEmbedHeaders({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Preview-Renderable": "true",
  });
}
