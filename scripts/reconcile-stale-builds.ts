#!/usr/bin/env npx tsx
/**
 * Reconcile stuck AI build_jobs and preview_build_jobs (failed_stale / waiting_for_worker).
 */
import { createSupabaseAdmin } from "../src/lib/supabase/admin";
import { reconcileStaleBuilds } from "../src/lib/build/stale-build-reconciler";

async function main() {
  const admin = createSupabaseAdmin();
  const summary = await reconcileStaleBuilds(admin);
  console.log("[reconcile:stale-builds]", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
