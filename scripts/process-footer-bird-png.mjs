/**
 * Prepares footer icy bird PNG: trim, preserve alpha, export hi-res WebP/PNG.
 * Usage: node scripts/process-footer-bird-png.mjs [inputPath]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "assets", "icy-bird-static.png");
const OUTPUT = path.join(ROOT, "public", "footer", "icy-bird-static.png");
const OUTPUT_META = path.join(ROOT, "public", "footer", "icy-bird-static.meta.json");

const TARGET_WIDTH = 520;

function isBackgroundPixel(r, g, b, a) {
  if (a < 12) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;

  if (b > r + 8 && sat > 0.05) return false;
  if (sat > 0.16) return false;
  if (max > 55 && b > r + 3) return false;

  const neutral = Math.abs(r - g) < 24 && Math.abs(g - b) < 24;
  if (neutral && max > 80) return true;
  return max < 35;
}

async function main() {
  const input = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT;
  if (!fs.existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }

  const metaIn = await sharp(input).metadata();
  let pipeline = sharp(input).ensureAlpha();

  if (!metaIn.hasAlpha) {
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i += channels) {
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const a = out[i + 3] ?? 255;
      if (isBackgroundPixel(r, g, b, a)) out[i + 3] = 0;
    }
    pipeline = sharp(out, { raw: { width, height, channels: 4 } });
  }

  const trimmed = await pipeline.trim({ threshold: 2 }).toBuffer();
  const resized = await sharp(trimmed)
    .resize({
      width: TARGET_WIDTH,
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      effort: 10,
    })
    .toBuffer();

  const meta = await sharp(resized).metadata();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, resized);
  fs.writeFileSync(
    OUTPUT_META,
    JSON.stringify({ width: meta.width, height: meta.height }, null, 2),
  );

  console.log(`Wrote ${OUTPUT} (${meta.width}x${meta.height}, alpha=${meta.hasAlpha})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
