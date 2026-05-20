# Supabase custom auth domain (DreamOS86)

Google OAuth shows the **hostname of `NEXT_PUBLIC_SUPABASE_URL`** in the account chooser (e.g. `xycqutvqxtkbszytaxbe.supabase.co`). To show a branded domain such as `auth.dreamos86.com`, configure Supabase Custom Domain and update env + OAuth clients.

## 1. Enable custom domain in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **Custom Domains** (or Auth custom domain).
2. Add a subdomain, for example:
   - `auth.dreamos86.com`, or
   - `api.dreamos86.com`
3. Add the DNS records Supabase provides (CNAME / TXT as shown).
4. Wait until the domain shows **Active**.

## 2. Google Cloud OAuth client

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth client:

**Authorized redirect URIs** (keep both during transition):

- `https://<project-ref>.supabase.co/auth/v1/callback` (legacy)
- `https://auth.dreamos86.com/auth/v1/callback` (after custom domain is live)

Replace `auth.dreamos86.com` with your chosen Supabase custom domain.

## 3. Supabase Auth URL configuration

Dashboard → **Authentication** → **URL Configuration**:

| Setting | Value |
|--------|--------|
| **Site URL** | `https://dreamos86.com` |
| **Redirect URLs** | `https://dreamos86.com/auth/callback` |
| | `http://localhost:3000/auth/callback` |
| | Vercel preview URLs if used (e.g. `https://*.vercel.app/auth/callback`) |

## 4. Vercel / production environment

Set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://auth.dreamos86.com
```

Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` unchanged (same project).

Redeploy the Next.js app after updating env.

## 5. Local development

For localhost, you can keep:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
```

Or point local env at the custom domain once DNS and Supabase are verified.

Ensure `http://localhost:3000/auth/callback` remains in Supabase redirect URLs.

## 6. Verify

1. Sign in with Google on production.
2. Google chooser should show **auth.dreamos86.com** (or your custom domain), not `*.supabase.co`.
3. After login, user lands on `https://dreamos86.com/auth/callback` (or `next` target).
4. Visiting `/contact` or `/pricing` while logged in should **not** sign the user out.

## App code

- OAuth `redirectTo` uses `${origin}/auth/callback` via `src/lib/auth/oauth-redirect.ts`.
- Admin **Auth health** shows a warning when `NEXT_PUBLIC_SUPABASE_URL` still contains `.supabase.co`.
