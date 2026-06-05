import "server-only";

import type { AppAuthSettings } from "@/lib/publish/default-auth-pages";
import type { PublishedAuthClientConfig } from "@/lib/publish/published-auth-config";

type AuthPageKind = "login" | "signup" | "forgot" | "callback";

function pageKind(route: string): AuthPageKind {
  const r = route.toLowerCase();
  if (r.includes("signup") || r.includes("sign-up") || r.includes("register")) return "signup";
  if (r.includes("forgot") || r.includes("reset")) return "forgot";
  if (r.includes("callback")) return "callback";
  return "login";
}

function authPath(base: string, segment: string): string {
  const b = base.replace(/\/$/, "");
  return `${b}/${segment.replace(/^\//, "")}`;
}

export function buildPublishedAuthPageHtml(input: {
  appName: string;
  iconUrl?: string | null;
  route: string;
  settings: AppAuthSettings;
  auth: PublishedAuthClientConfig;
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

  const base = input.auth.authBasePath;
  const providers: string[] = [];
  if (input.settings.google_enabled) providers.push("google");
  if (input.settings.github_enabled) providers.push("github");
  if (input.settings.apple_enabled) providers.push("apple");

  const oauthBtns = providers
    .map(
      (p) =>
        `<button type="button" class="oauth" data-provider="${p}" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:8px">Continue with ${p.charAt(0).toUpperCase() + p.slice(1)}</button>`,
    )
    .join("");

  const emailForm =
    input.settings.email_password_enabled && kind !== "callback"
      ? `<form id="vx-auth-form" style="margin-top:16px">
          <div id="vx-error" style="display:none;margin-bottom:8px;padding:10px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px"></div>
          <input type="email" name="email" placeholder="Email" required autocomplete="email" style="width:100%;padding:11px 14px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:8px;font-size:14px" />
          ${kind !== "forgot" ? `<input type="password" name="password" placeholder="Password" required autocomplete="${kind === "signup" ? "new-password" : "current-password"}" style="width:100%;padding:11px 14px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:8px;font-size:14px" />` : ""}
          <button type="submit" id="vx-submit" style="width:100%;padding:12px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-weight:600;font-size:14px;cursor:pointer">${kind === "forgot" ? "Send reset link" : kind === "signup" ? "Create account" : "Sign in"}</button>
        </form>`
      : "";

  const links =
    kind === "login"
      ? `<p style="margin-top:16px;font-size:13px;color:#64748b;text-align:center"><a href="${authPath(base, "signup")}" style="color:#2563eb">Create account</a> · <a href="${authPath(base, "forgot-password")}" style="color:#2563eb">Forgot password?</a></p>`
      : kind === "signup"
        ? `<p style="margin-top:16px;font-size:13px;color:#64748b;text-align:center"><a href="${authPath(base, "login")}" style="color:#2563eb">Already have an account?</a></p>`
        : "";

  const icon = input.iconUrl
    ? `<img src="${input.iconUrl}" alt="" width="56" height="56" style="width:56px;height:56px;border-radius:14px;object-fit:cover" />`
    : `<div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:22px">${input.appName.charAt(0).toUpperCase()}</div>`;

  const configJson = JSON.stringify({
    supabaseUrl: input.auth.supabaseUrl,
    supabaseAnonKey: input.auth.supabaseAnonKey,
    callbackUrl: input.auth.callbackUrl,
    slug: input.auth.slug,
    kind,
    authBase: base,
    providers,
    emailEnabled: input.settings.email_password_enabled,
    centralOAuthOrigin: input.auth.centralOAuthOrigin,
  });

  const runtimeScript = `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script id="vodex-published-auth-runtime">
(function(){
  var CFG=${configJson};
  var params=new URLSearchParams(location.search);
  var fromUrl=params.get("from_url")||params.get("from")||CFG.authBase||"/";
  var errEl=document.getElementById("vx-error");
  function showErr(msg){if(errEl){errEl.style.display="block";errEl.textContent=msg;}if(window.vodexTrack)vodexTrack("auth_error",{message:String(msg).slice(0,120)});}
  function track(type,extra){if(window.vodexTrack)vodexTrack(type,extra||{});}
  if(!window.supabase||!CFG.supabaseUrl||!CFG.supabaseAnonKey){showErr("Auth is not configured.");return;}
  var client=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{flowType:"pkce",detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storage:window.localStorage}});
  async function syncProfile(eventType,provider){
    var sess=(await client.auth.getSession()).data.session;
    if(!sess) return;
    await fetch("/api/public/"+encodeURIComponent(CFG.slug)+"/auth/sync",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sess.access_token},body:JSON.stringify({eventType:eventType,provider:provider||null})}).catch(function(){});
  }
  async function finishAuth(eventType,provider){
    track(eventType,{provider:provider||"email"});
    await syncProfile(eventType,provider);
    location.href=fromUrl||CFG.authBase||"/";
  }
  if(CFG.kind==="callback"){
    track("auth_screen_view",{screen:"callback"});
    showErr("Completing sign-in…");
    return;
  }
  track("auth_screen_view",{screen:CFG.kind});
  document.querySelectorAll(".oauth").forEach(function(btn){
    btn.onclick=function(){
      var p=btn.getAttribute("data-provider");
      track("auth_screen_view",{provider:p});
      var oauthOrigin=CFG.centralOAuthOrigin||"";
      location.href=(oauthOrigin||"")+"/api/public/"+encodeURIComponent(CFG.slug)+"/auth/oauth?provider="+encodeURIComponent(p)+"&from_url="+encodeURIComponent(fromUrl);
    };
  });
  var form=document.getElementById("vx-auth-form");
  if(form) form.onsubmit=async function(e){
    e.preventDefault();
    var fd=new FormData(form);
    var email=String(fd.get("email")||"").trim();
    var password=String(fd.get("password")||"");
    var btn=document.getElementById("vx-submit");
    if(btn) btn.disabled=true;
    try{
      if(CFG.kind==="forgot"){
        var reset=await client.auth.resetPasswordForEmail(email,{redirectTo:CFG.callbackUrl+"?type=recovery&from_url="+encodeURIComponent(fromUrl)});
        if(reset.error) throw reset.error;
        track("password_reset_requested",{});
        showErr("Check your email for a reset link.");
        return;
      }
      if(CFG.kind==="signup"){
        var su=await client.auth.signUp({email:email,password:password,options:{emailRedirectTo:CFG.callbackUrl+"?from_url="+encodeURIComponent(fromUrl)}});
        if(su.error) throw su.error;
        if(su.data.session) await finishAuth("signup_success","email");
        else showErr("Check your email to confirm your account.");
        return;
      }
      var si=await client.auth.signInWithPassword({email:email,password:password});
      if(si.error) throw si.error;
      await finishAuth("login_success","email");
    }catch(err){showErr(err&&err.message?err.message:"Sign in failed");}
    finally{if(btn) btn.disabled=false;}
  };
})();
</script>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title} · ${input.appName}</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(180deg,#f8fafc,#f1f5f9);display:flex;align-items:center;justify-content:center;padding:24px}#vx-error:empty{display:none!important}</style></head>
<body><main style="width:100%;max-width:400px;background:#fff;border-radius:20px;padding:32px 28px;box-shadow:0 20px 50px rgba(15,23,42,.08);border:1px solid #e2e8f0">
<div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:24px">${icon}<h1 style="margin:14px 0 4px;font-size:22px;font-weight:700;color:#0f172a">${input.appName}</h1><p style="margin:0;font-size:14px;color:#64748b">${title}</p></div>
${oauthBtns}${emailForm}${links}
</main>${runtimeScript}</body></html>`;
}

export function buildAuthNotConfiguredPage(appName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Auth unavailable</title></head><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc"><main style="max-width:360px;padding:24px;text-align:center"><h1 style="font-size:18px">${appName}</h1><p style="color:#64748b;font-size:14px">Sign-in is not available right now. The app owner can enable authentication in Vodex Settings.</p></main></body></html>`;
}

