import "dotenv/config";
function req(name) {
    const v = process.env[name]?.trim();
    if (!v)
        throw new Error(`Missing required env: ${name}`);
    return v;
}
function decodeJwtRole(key) {
    const parts = key.split(".");
    if (parts.length < 2)
        return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return typeof payload.role === "string" ? payload.role : null;
    }
    catch {
        return null;
    }
}
function reqServiceRoleKey() {
    const key = req("SUPABASE_SERVICE_ROLE_KEY");
    const role = decodeJwtRole(key);
    if (role !== "service_role") {
        throw new Error(`SUPABASE_SERVICE_ROLE_KEY must be a service_role JWT (got role=${role ?? "unknown"}). ` +
            "Do not use NEXT_PUBLIC_SUPABASE_ANON_KEY or the anon key here.");
    }
    return key;
}
function num(name, fallback) {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}
export const config = {
    supabaseUrl: req("SUPABASE_URL"),
    supabaseServiceRoleKey: reqServiceRoleKey(),
    workerId: process.env.PREVIEW_WORKER_ID?.trim() || `worker-${process.pid}`,
    workspaceDir: process.env.PREVIEW_WORKSPACE_DIR?.trim() || "/tmp/vodex-preview-workspaces",
    artifactBucket: process.env.PREVIEW_ARTIFACT_BUCKET?.trim() || "preview-artifacts",
    sourceBucket: process.env.PREVIEW_SOURCE_BUCKET?.trim() || "preview-sources",
    jobConcurrency: Math.max(1, num("PREVIEW_JOB_CONCURRENCY", 1)),
    installTimeoutMs: num("PREVIEW_INSTALL_TIMEOUT_MS", 180_000),
    buildTimeoutMs: num("PREVIEW_BUILD_TIMEOUT_MS", 180_000),
    maxFiles: num("PREVIEW_MAX_FILES", 20_000),
    maxSourceMb: num("PREVIEW_MAX_SOURCE_MB", 250),
    pollIntervalMs: num("PREVIEW_POLL_INTERVAL_MS", 5000),
    allowNpmScripts: process.env.PREVIEW_ALLOW_NPM_SCRIPTS === "1",
    /** V8 heap for Vite/React production builds (MB). */
    nodeMaxOldSpaceMb: Math.max(512, num("PREVIEW_NODE_MAX_OLD_SPACE_MB", 4096)),
};
export function serviceRoleKeyPrefix() {
    return config.supabaseServiceRoleKey.slice(0, 10);
}
