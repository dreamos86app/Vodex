/**
 * Verify DreamOS86 platform icons keep a real alpha channel (not flattened matte).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const CHECKS = [
  { label: "canonical brand icon", path: "public/brand/dreamos86-icon.png" },
  { label: "favicon 32", path: "public/favicon-32x32.png" },
  { label: "app icon", path: "src/app/icon.png" },
];

const CORNER_OFFSETS = [
  [0, 0],
  [1, 0],
  [0, 1],
];

function cornerAlpha(data, width, x, y) {
  const i = (y * width + x) * 4;
  return data[i + 3];
}

async function checkFile(relPath) {
  const abs = path.join(ROOT, relPath);
  try {
    await fs.access(abs);
  } catch {
    return { ok: false, error: `missing: ${relPath}` };
  }

  const meta = await sharp(abs).metadata();
  if (!meta.hasAlpha) {
    return { ok: false, error: `${relPath}: no alpha channel (flattened?)` };
  }

  const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  let transparentCorners = 0;
  for (const [dx, dy] of CORNER_OFFSETS) {
    const corners = [
      cornerAlpha(data, w, dx, dy),
      cornerAlpha(data, w, w - 1 - dx, dy),
      cornerAlpha(data, w, dx, h - 1 - dy),
      cornerAlpha(data, w, w - 1 - dx, h - 1 - dy),
    ];
    if (corners.some((a) => a < 32)) transparentCorners += 1;
  }

  if (transparentCorners === 0) {
    return {
      ok: false,
      error: `${relPath}: corners are opaque — likely black/white matte (flattened)`,
    };
  }

  let opaqueBlack = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a > 240 && r < 12 && g < 12 && b < 12) opaqueBlack += 1;
  }
  const total = data.length / 4;
  const blackRatio = opaqueBlack / total;
  if (blackRatio > 0.35) {
    return {
      ok: false,
      error: `${relPath}: ${(blackRatio * 100).toFixed(1)}% opaque black pixels — matte background`,
    };
  }

  return { ok: true, width: w, height: h, hasAlpha: true };
}

async function main() {
  let failed = false;
  for (const { label, path: rel } of CHECKS) {
    const result = await checkFile(rel);
    if (result.ok) {
      console.log(`[icons:check] OK ${label} (${result.width}x${result.height}, alpha)`);
    } else {
      console.error(`[icons:check] FAIL ${label}:`, result.error);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log("[icons:check] All checks passed.");
}

main().catch((err) => {
  console.error("[icons:check] Error:", err);
  process.exit(1);
});
