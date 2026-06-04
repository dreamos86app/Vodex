import * as fs from "node:fs/promises";
import * as os from "node:os";
import { config } from "./config.js";
import { childBuildNodeOptions } from "./sanitize-node-options.js";
import { log } from "./logger.js";
export const VITE_BUILD_OOM_CODE = "VITE_BUILD_OOM";
export const PREVIEW_WORKER_MEMORY_TOO_LOW = "PREVIEW_WORKER_MEMORY_TOO_LOW";
export const VITE_BUILD_OOM_USER_MESSAGE = "This ZIP is too large for the current preview worker memory. Increase worker memory or reduce bundle size.";
const OOM_RE = /JavaScript heap out of memory|Reached heap limit|Allocation failed|FATAL ERROR/i;
export function isOomOutput(logs) {
    return OOM_RE.test(logs);
}
/** Read container RAM limit (MB) when cgroup is available; else host total memory. */
export async function readContainerMemoryLimitMb() {
    const paths = [
        "/sys/fs/cgroup/memory.max",
        "/sys/fs/cgroup/memory/memory.limit_in_bytes",
    ];
    for (const p of paths) {
        try {
            const raw = (await fs.readFile(p, "utf8")).trim();
            if (raw === "max")
                continue;
            const bytes = Number(raw);
            if (Number.isFinite(bytes) && bytes > 0 && bytes < 1e15) {
                return Math.floor(bytes / (1024 * 1024));
            }
        }
        catch {
            continue;
        }
    }
    return Math.floor(os.totalmem() / (1024 * 1024));
}
/** Reserve headroom for npm + OS outside the V8 heap. */
const HEAP_HEADROOM_MB = 512;
export function assertWorkerMemoryForNodeHeap(requestedHeapMb, containerLimitMb) {
    if (containerLimitMb == null)
        return null;
    const requiredTotal = requestedHeapMb + HEAP_HEADROOM_MB;
    if (containerLimitMb < requiredTotal) {
        return PREVIEW_WORKER_MEMORY_TOO_LOW;
    }
    return null;
}
/** @deprecated Use childBuildNodeOptions — never merge inherited NODE_OPTIONS. */
export function mergeNodeOptions(maxOldSpaceMb) {
    return childBuildNodeOptions(maxOldSpaceMb);
}
export function previewBuildEnv() {
    const maxMb = config.nodeMaxOldSpaceMb;
    const { NODE_OPTIONS: _inherited, ...baseEnv } = process.env;
    return {
        ...baseEnv,
        NODE_ENV: "production",
        NPM_CONFIG_PRODUCTION: "false",
        CI: "true",
        NODE_OPTIONS: childBuildNodeOptions(maxMb),
    };
}
export async function validateBuildMemoryAtStartup() {
    const limitMb = await readContainerMemoryLimitMb();
    const tooLow = assertWorkerMemoryForNodeHeap(config.nodeMaxOldSpaceMb, limitMb);
    if (tooLow) {
        log("error", PREVIEW_WORKER_MEMORY_TOO_LOW, {
            requestedHeapMb: config.nodeMaxOldSpaceMb,
            containerLimitMb: limitMb,
            requiredMb: config.nodeMaxOldSpaceMb + HEAP_HEADROOM_MB,
            hint: "Increase Railway service memory or lower PREVIEW_NODE_MAX_OLD_SPACE_MB",
        });
        process.exit(1);
    }
    log("info", "build memory config", {
        nodeMaxOldSpaceMb: config.nodeMaxOldSpaceMb,
        containerLimitMb: limitMb,
        nodeOptions: childBuildNodeOptions(config.nodeMaxOldSpaceMb),
    });
}
