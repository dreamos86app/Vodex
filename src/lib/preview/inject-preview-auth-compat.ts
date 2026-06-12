/** Preview-only auth compat — Base44 / Supabase clients missing redirectToLogin in iframe. */

import { buildPreviewAuthGuardScript } from "@/lib/preview/inject-preview-auth-guard";
import {
  PREVIEW_AUTH_NAV_FN,
  PREVIEW_AUTH_URL_RESOLVER_SNIPPET,
  buildPreviewRuntimeAuthUrlBootstrapScript,
} from "@/lib/preview/preview-runtime-auth-url-script";
import { PREVIEW_WELCOME_ROUTE_SNIPPET } from "@/lib/preview/preview-welcome-route-script";

export function buildPreviewAuthCompatScript(): string {
  return `(function(){
  if(window.__VODEX_AUTH_COMPAT__)return;
  window.__VODEX_AUTH_COMPAT__=true;
  ${PREVIEW_AUTH_URL_RESOLVER_SNIPPET}
  ${PREVIEW_WELCOME_ROUTE_SNIPPET}
  var mockUser={id:"preview-user",email:"preview@vodex.dev",user_metadata:{full_name:"Preview User"}};
  function previewAuthed(){return __vodexPreviewAuthed();}
  function navLogin(){
    if(previewAuthed()){
      if(typeof window.__vodexPreviewGoAppHome==="function"&&window.__vodexPreviewGoAppHome("auth compat authed -> app home"))return Promise.resolve({data:{user:mockUser,session:{user:mockUser}},error:null});
      try{
        var t=sessionStorage.getItem("vodex-preview-post-auth-route")||window.__VODEX_PREVIEW_APP_HOME__||"/home";
        if(typeof window.__vodexPreviewAppUrl==="function"){
          var u=window.__vodexPreviewAppUrl(t);
          if(u){window.location.replace(u);return Promise.resolve({data:{user:mockUser,session:{user:mockUser}},error:null});}
        }
      }catch(e){}
      return Promise.resolve({data:{user:mockUser,session:{user:mockUser}},error:null});
    }
    __vodexGoLogin("auth compat -> Vodex preview login");
    return Promise.resolve({ok:true});
  }
  function navSignup(){
    if(typeof window.__vodexPreviewGoSignup==="function"&&window.__vodexPreviewGoSignup("auth compat signup"))return Promise.resolve({ok:true});
    var u=__vodexResolveLoginUrl();
    if(u){window.location.replace(u.replace(/\\/login$/,"/signup"));return Promise.resolve({ok:true});}
    return navLogin();
  }
  function enrichAuth(auth){
    if(!auth||typeof auth!=="object")return auth;
    var names=["redirectToLogin","login","signIn","requireAuth"];
    for(var i=0;i<names.length;i++){
      (function(name){
        if(typeof auth[name]!=="function"){
          auth[name]=function(){
            if(previewAuthed()){
              if(name==="redirectToLogin"||name==="login"||name==="signIn"){
                if(typeof window.__vodexPreviewGoAppHome==="function")window.__vodexPreviewGoAppHome("redirectToLogin while authed");
                return Promise.resolve(mockUser);
              }
              return Promise.resolve(mockUser);
            }
            if(name==="requireAuth"&&__vodexIsWelcomeRoute())return Promise.reject(new Error("Authentication required"));
            return navLogin();
          };
        }
      })(names[i]);
    }
    if(typeof auth.redirectToSignup!=="function")auth.redirectToSignup=navSignup;
    if(typeof auth.signUp!=="function")auth.signUp=navSignup;
    if(typeof auth.signInWithOAuth!=="function")auth.signInWithOAuth=function(){return navLogin();};
    if(typeof auth.signInWithPopup!=="function")auth.signInWithPopup=function(){return navLogin();};
    if(typeof auth.signInWithOtp!=="function")auth.signInWithOtp=function(){return Promise.resolve({data:{user:mockUser,session:{user:mockUser}},error:null});};
    if(typeof auth.me!=="function")auth.me=function(){return Promise.resolve(previewAuthed()?mockUser:null);};
    if(typeof auth.logout!=="function")auth.logout=function(){try{localStorage.removeItem("sb-preview-auth");}catch(e){}return Promise.resolve();};
    if(typeof auth.getUser!=="function")auth.getUser=function(){return Promise.resolve({data:{user:previewAuthed()?mockUser:null},error:null});};
    if(typeof auth.getSession!=="function")auth.getSession=function(){return Promise.resolve({data:{session:previewAuthed()?{user:mockUser}:null},error:null});};
    if(typeof auth.onAuthStateChange!=="function")auth.onAuthStateChange=function(cb){try{if(cb)cb(previewAuthed()?"SIGNED_IN":"SIGNED_OUT",previewAuthed()?{user:mockUser}:null);}catch(e){}return {data:{subscription:{unsubscribe:function(){}}}};};
    if(typeof auth.signOut!=="function")auth.signOut=function(){return Promise.resolve({error:null});};
  }
  window.__vodexEnrichAuth=enrichAuth;
  function wrapClient(client){
    if(!client||client.__vodexAuthWrapped)return client;
    if(client.auth)enrichAuth(client.auth);
    client.__vodexAuthWrapped=true;
    return client;
  }
  function patchCreateClient(name,factory){
    if(typeof factory!=="function")return;
    window[name]=function(){
      return wrapClient(factory.apply(this,arguments));
    };
  }
  patchCreateClient("createClient",window.createClient);
  patchCreateClient("createBase44Client",window.createBase44Client);
  try{
    var _assign=Object.assign;
    Object.assign=function(target){
      var out=_assign.apply(Object,arguments);
      for(var i=1;i<arguments.length;i++){
        var src=arguments[i];
        if(src&&src.auth)enrichAuth(src.auth);
      }
      if(target&&target.auth)enrichAuth(target.auth);
      return out;
    };
  }catch(e){}
})();`;
}

/** Prepend auth compat to served JS bundles (Vite chunks with inlined Base44 client). */
export function prependPreviewAuthCompatToJs(bundle: string): string {
  if (bundle.includes("__VODEX_AUTH_COMPAT__")) return bundle;
  return `${buildPreviewRuntimeAuthUrlBootstrapScript()}\n${buildPreviewAuthGuardScript()}\n${buildPreviewAuthCompatScript()}\n${patchMinifiedAuthObjectsInJs(bundle)}`;
}

/** Patch sanitized Base44 auth literals baked into built chunks (missing redirectToLogin). */
export function patchMinifiedAuthObjectsInJs(text: string): string {
  return text.replace(
    /auth:\{(?![^}]{0,500}redirectToLogin)(getUser|getSession|onAuthStateChange)/g,
    `auth:{redirectToLogin:${PREVIEW_AUTH_NAV_FN},$1`,
  );
}

export function injectPreviewAuthCompat(html: string): string {
  if (html.includes("vodex-preview-auth-compat")) return html;
  const script = `<script id="vodex-preview-auth-compat" data-vodex-preview-shim="true">${buildPreviewAuthCompatScript()}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
