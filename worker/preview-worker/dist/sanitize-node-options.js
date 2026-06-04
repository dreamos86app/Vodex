import { log } from "./logger.js";
/** Flags that break Node on Railway / Nixpacks when injected into NODE_OPTIONS. */
const UNSAFE_NODE_OPTIONS = /\$|harmony-import|no-harmony|experimental-wasm|experimental-wasm-imported-strings|experimental-wasm-memory64|experimental-wasm-exnref/i;
/**
 * Vite/npm child builds only — never set on the worker process itself.
 */
export function childBuildNodeOptions(maxOldSpaceMb) {
    const mb = Math.max(256, Math.floor(Number(maxOldSpaceMb) || 4096));
    if (!Number.isFinite(mb)) {
        return "--max-old-space-size=4096";
    }
    return `--max-old-space-size=${mb}`;
}
/**
 * Railway/Nixpacks may inject NODE_OPTIONS before `node dist/index.js` runs.
 * start.sh clears them first; this is a second line of defense for child env and logging.
 */
export function sanitizeInheritedNodeOptionsForWorkerBoot() {
    const raw = process.env.NODE_OPTIONS?.trim();
    if (!raw)
        return;
    const unsafe = UNSAFE_NODE_OPTIONS.test(raw) || /--max-old-space-size=\$/.test(raw);
    const hasHeap = /max-old-space-size/i.test(raw);
    if (unsafe || hasHeap) {
        log("warn", "Removing inherited NODE_OPTIONS from worker process", {
            preview: raw.length > 160 ? `${raw.slice(0, 160)}…` : raw,
            reason: unsafe ? "unsupported_or_interpolated_flags" : "heap_belongs_on_vite_child_only",
        });
        delete process.env.NODE_OPTIONS;
    }
}
