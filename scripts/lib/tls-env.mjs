/**
 * Safe TLS helpers for verify scripts (never disable TLS verification).
 */

/** @returns {boolean} */
export function isTlsRejectDisabled() {
  return process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
}

/** @returns {boolean} */
export function isSystemCaEnabled() {
  return process.env.NODE_USE_SYSTEM_CA === "1";
}

/**
 * Apply safe TLS env for Node fetch on Windows (uses OS trust store).
 * Does NOT set NODE_TLS_REJECT_UNAUTHORIZED=0.
 * @param {NodeJS.ProcessEnv} [base]
 */
export function withSafeTlsEnv(base = process.env) {
  const next = { ...base };
  if (!next.NODE_USE_SYSTEM_CA) {
    next.NODE_USE_SYSTEM_CA = "1";
  }
  return next;
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTlsFetchError(err) {
  const e = /** @type {{ code?: string; message?: string; cause?: { code?: string } }} */ (err);
  const code = e?.cause?.code ?? e?.code ?? "";
  const msg = String(e?.message ?? err ?? "");
  return (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "UNABLE_TO_GET_ISSUER_CERT" ||
    code === "CERT_HAS_EXPIRED" ||
    /unable to verify the first certificate/i.test(msg) ||
    /certificate/i.test(msg)
  );
}

/**
 * @param {string} [supabaseUrl]
 */
export function printTlsFix(supabaseUrl) {
  console.error("\n╔══════════════════════════════════════════════════════════════╗");
  console.error("║  TLS CERTIFICATE ERROR — NOT a missing database table issue  ║");
  console.error("╚══════════════════════════════════════════════════════════════╝\n");
  if (supabaseUrl) {
    console.error(`Supabase URL probed: ${supabaseUrl}\n`);
  }
  if (isTlsRejectDisabled()) {
    console.error("⚠ DANGER: NODE_TLS_REJECT_UNAUTHORIZED=0 is set in your environment.");
    console.error("  Remove it from Windows User/System Environment Variables.");
    console.error("  Do NOT use it as a fix.\n");
  }
  console.error("Safe fix for Cursor terminal (Windows PowerShell):\n");
  console.error('  $env:NODE_USE_SYSTEM_CA="1"\n');
  console.error("Then re-run:\n");
  console.error("  npm run verify:tls");
  console.error("  npm run verify:credit-economy-db\n");
  console.error("Optional — persist for current PowerShell session only:\n");
  console.error('  $env:NODE_USE_SYSTEM_CA="1"; npm run verify:all\n');
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
export async function safeFetch(url, init) {
  const prev = process.env.NODE_USE_SYSTEM_CA;
  if (!prev) {
    process.env.NODE_USE_SYSTEM_CA = "1";
  }
  try {
    return await fetch(url, init);
  } finally {
    if (prev === undefined) delete process.env.NODE_USE_SYSTEM_CA;
    else process.env.NODE_USE_SYSTEM_CA = prev;
  }
}
