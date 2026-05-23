# Verify DreamOS86 is fully working

## 1. Env alignment (must all match `wciioegiczwqlmlroley`)

```bash
npm run verify:health
```

On Windows if Node TLS fails:

```powershell
$env:DREAMOS_VERIFY_INSECURE_TLS="1"; npm run verify:health
```

Manual checks in `.env.local` / Vercel:

| Variable | Source in Supabase dashboard |
|----------|------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wciioegiczwqlmlroley.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API Keys → Legacy → **anon** `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | API Keys → Legacy → **service_role** `secret` |

All three must be from the **same** project. Mixed refs (old `xycqut` URL + new keys) break auth and admin.

## 2. Build / types

```bash
npm run typecheck
npm run build
```

## 3. Supabase (database + PostgREST)

After `scripts/dreamos-runtime-repair.sql` (or Copy SQL patch):

```sql
NOTIFY pgrst, 'reload schema';
```

Service-role REST smoke test (PowerShell):

```powershell
$sr = "<service_role JWT>"
$h = @{ apikey = $sr; Authorization = "Bearer $sr" }
$base = "https://wciioegiczwqlmlroley.supabase.co"
Invoke-RestMethod -Uri "$base/rest/v1/rpc/dreamos_debug_credit_rpc" -Method POST -Headers $h -Body "{}"
```

Expect JSON with `charge_tokens_signatures` (non-empty array).

## 4. Onboarding (`answers` column)

If you see **Could not find the 'answers' column of 'onboarding' in the schema cache**:

1. Run `scripts/complete-onboarding-schema.sql` in Supabase SQL Editor (or ensure `dreamos-runtime-repair.sql` includes onboarding).
2. `NOTIFY pgrst, 'reload schema';` and wait ~30s.
3. Retry **Start building** on `/onboarding`.

## 5. Local app (logged in as owner)

1. `npm run dev`
2. Open **Admin** → schema health banner → should show **OK** / empty `missing`
3. Or: `GET http://localhost:3000/api/admin/schema-health?refresh=1` (owner session cookie)
4. **Diagnostics** drawer → Overview → no red schema blockers
5. **Copy SQL** → first line must be `-- DreamOS86 credit billing repair patch`, not `import`

## 6. Production (Vercel)

1. Update all Supabase env vars to `wciioegiczwqlmlroley` keys
2. Redeploy Production
3. Repeat admin schema health on `https://dreamos86.com`
