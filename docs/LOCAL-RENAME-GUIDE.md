# Local folder rename guide (DreamOS86 → Vodex)

Renaming your local checkout does **not** change production config (Vercel, Supabase, Paddle, GitHub OAuth, or env vars). Do this when you want a cleaner path on disk.

## Steps

1. **Close Cursor** (or any editor using this repo).
2. **Stop the dev server** (`Ctrl+C` in the terminal running `npm run dev`).
3. **Rename the parent folder** (optional but recommended):
   - `Desktop/DreamOS86` → `Desktop/Vodex`
4. **Rename the repo folder**:
   - `dreamos-platform` → `vodex-platform`
5. **Reopen the project** in Cursor at:
   - `Desktop/Vodex/vodex-platform`
6. **Reinstall and run**:
   ```bash
   npm install
   npm run dev
   ```
7. **Confirm git still works**:
   ```bash
   git status
   git remote -v
   ```

## What does not change

- Git history and remotes
- `package.json` name (`vodex-platform`) — already updated in repo
- Supabase project ref `wciioegiczwqlmlroley`
- Production URLs (`https://vodex.dev`)
- Environment variables on Vercel — update only in the dashboard if needed, not because of folder rename

## If something breaks locally

- Delete `.next` and run `npm run dev` again: `npm run clean && npm run dev`
- Re-copy `.env.local` if it was left in the old folder path
