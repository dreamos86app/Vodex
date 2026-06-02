import sharp from "sharp";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ensurePublicBucket } from "@/lib/supabase/ensure-storage-bucket";
import { routeImageProvider } from "@/lib/ai/image-provider-routing";
import { isProviderConfigured } from "@/lib/ai/provider-availability";
import { generateAppIconSvg } from "@/lib/creation/app-icon-svg";
import { isDreamOSMediaProviderDisabled } from "@/lib/media/dreamos-media-router";

const LOGO_BUCKET = "project-icons";
const MIN_LOGO_PX = 720;

export type LogoAssetUrls = {
  iconUrl: string;
  iconOriginalUrl: string;
  icon512Url: string;
  icon192Url: string;
  faviconUrl: string;
};

export type LogoGenerationResult =
  | {
      ok: true;
      urls: LogoAssetUrls;
      provider: string;
      modelId: string;
      providerCostUsd: number;
      width: number;
      height: number;
    }
  | {
      ok: false;
      error: string;
      providerCostUsd: number;
    };

export function buildLogoPrompt(input: {
  appName: string;
  shortDescription: string;
  category?: string;
}): string {
  const purpose = input.shortDescription.trim() || input.category || "modern SaaS app";
  const cat = (input.category ?? "").toLowerCase();
  if (
    cat.includes("subscription") ||
    /subscription box|box curation|churn analytics|shipping labels/i.test(purpose)
  ) {
    return [
      `A premium modern app icon for a subscription box management SaaS called ${input.appName},`,
      "abstract box or package symbol with subtle analytics line, glowing violet-indigo gradient,",
      "clean SaaS style, centered symbol, no text, high contrast, rounded app icon, professional minimal.",
    ].join(" ");
  }
  if (cat.includes("portfolio") || /developer portfolio|showcase/i.test(purpose)) {
    return [
      `A premium modern app icon for a developer portfolio called ${input.appName},`,
      "abstract code brackets or terminal window motif, glowing indigo-violet gradient,",
      "clean SaaS style, centered symbol, no text, high contrast, rounded app icon shape,",
      "professional minimal design, maskable-safe center composition.",
    ].join(" ");
  }
  return [
    `Premium app icon symbol for ${input.appName} (${purpose}).`,
    "1024x1024, bold abstract glyph or object — symbolic mark only, no logotype.",
    "NO text, NO letters, NO words, NO initials.",
    "Symbol fills 92% of canvas edge-to-edge; full-bleed saturated gradient background.",
    "Circular mask safe: no white corners, no white border, no empty ring, no square matte.",
    "High contrast, app-store quality, minimal, professional, maskable center composition.",
    "Forbidden: typography, watermark, photo border, drop shadow outside circle, tiny centered logo.",
  ].join(" ");
}

const VISUAL_MASS_MIN_RATIO = 0.6;
const WHITE_CORNER_LUMA = 235;

/** Scale small glyphs so non-transparent content fills the circular mask. */
export async function scaleIconVisualMass(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height || channels < 4) return buffer;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if ((data[i + 3] ?? 0) > 28) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return buffer;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const ratio = (bw * bh) / (width * height);
  if (ratio >= VISUAL_MASS_MIN_RATIO) return buffer;

  const pad = Math.round(Math.max(bw, bh) * 0.06);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const w = Math.min(width - left, bw + pad * 2);
  const h = Math.min(height - top, bh + pad * 2);

  return sharp(buffer)
    .extract({ left, top, width: w, height: h })
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .modulate({ saturation: 1.12, brightness: 1.04 })
    .flatten({ background: { r: 15, g: 23, b: 42 } })
    .png()
    .toBuffer()
    .catch(() => buffer);
}

export type IconVisualValidation = {
  ok: boolean;
  massRatio: number;
  textLike: boolean;
  whiteCorners: boolean;
};

/** Heuristic: reject tiny marks, text-like strokes, or white matte corners. */
export async function validateIconVisualQuality(buffer: Buffer): Promise<IconVisualValidation> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height || channels < 4) {
    return { ok: false, massRatio: 0, textLike: false, whiteCorners: true };
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const a = data[i + 3] ?? 0;
      if (a > 28) {
        opaque += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const massRatio = opaque / (width * height);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const aspect = bw / Math.max(1, bh);
  const textLike = aspect > 2.4 && massRatio < 0.35;

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let whiteCorners = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * channels;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (r >= WHITE_CORNER_LUMA && g >= WHITE_CORNER_LUMA && b >= WHITE_CORNER_LUMA) whiteCorners += 1;
  }

  const ok = massRatio >= VISUAL_MASS_MIN_RATIO && !textLike && whiteCorners < 3;
  return { ok, massRatio, textLike, whiteCorners: whiteCorners >= 3 };
}

/** Re-flatten when corner pixels are mostly white (square matte artifact). */
export async function flattenWhiteCornerArtifacts(buffer: Buffer): Promise<Buffer> {
  const size = 1024;
  const sample = await sharp(buffer)
    .resize(size, size, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = sample;
  const w = info.width ?? size;
  const h = info.height ?? size;
  const ch = info.channels ?? 3;
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let whiteCorners = 0;
  for (const [x, y] of corners) {
    const i = (y * w + x) * ch;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (r >= WHITE_CORNER_LUMA && g >= WHITE_CORNER_LUMA && b >= WHITE_CORNER_LUMA) whiteCorners += 1;
  }
  if (whiteCorners < 3) return buffer;
  return sharp(buffer)
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .flatten({ background: { r: 15, g: 23, b: 42 } })
    .png()
    .toBuffer()
    .catch(() => buffer);
}

/** Trim near-white edge pixels and flatten corners before circular mask. */
async function normalizeIconBuffer(buffer: Buffer): Promise<Buffer> {
  const trimmed = await sharp(buffer)
    .trim({ threshold: 18 })
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .flatten({ background: { r: 15, g: 23, b: 42 } })
    .modulate({ saturation: 1.08 })
    .png()
    .toBuffer()
    .catch(() => buffer);

  return sharp(trimmed)
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .png()
    .toBuffer();
}

async function applyCircularMask(buffer: Buffer): Promise<Buffer> {
  const size = 1024;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="512" fill="white"/></svg>`,
  );
  return sharp(buffer)
    .resize(size, size, { fit: "cover", position: "centre" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** True when OpenAI image generation can run (key present, not kill-switched). */
export function isAiLogoGenerationAvailable(): boolean {
  if (isDreamOSMediaProviderDisabled("logo")) return false;
  return isProviderConfigured("openai");
}

async function generateOpenAiLogo(prompt: string): Promise<{
  buffer: Buffer;
  providerCostUsd: number;
  modelId: string;
}> {
  const route = routeImageProvider("image_simple");
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured for logo generation");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: route.modelId,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "low",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Image provider failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = json.data?.[0];
  if (!item) throw new Error("Image provider returned no image");

  let buffer: Buffer;
  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error("Failed to download generated image");
    buffer = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error("Image provider returned unsupported payload");
  }

  return { buffer, providerCostUsd: route.estimatedCostUsd, modelId: route.modelId };
}

async function validateLogoBuffer(buffer: Buffer): Promise<{ ok: true; width: number; height: number } | { ok: false; error: string }> {
  if (!buffer.length) return { ok: false, error: "empty_image" };
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < MIN_LOGO_PX || height < MIN_LOGO_PX) {
    return { ok: false, error: `image_too_small_${width}x${height}` };
  }
  const format = meta.format;
  if (!format || !["png", "jpeg", "webp"].includes(format)) {
    return { ok: false, error: `unsupported_format_${format ?? "unknown"}` };
  }
  return { ok: true, width, height };
}

async function uploadLogoDerivatives(
  projectId: string,
  operationId: string,
  source: Buffer,
): Promise<LogoAssetUrls> {
  const admin = createSupabaseAdmin();
  const bucket = await ensurePublicBucket(admin, LOGO_BUCKET);
  if (!bucket.ok) throw new Error(bucket.error);

  const basePath = `${projectId}/${operationId}`;
  const prepped = await normalizeIconBuffer(source);
  const massed = await scaleIconVisualMass(prepped);
  const cornerFixed = await flattenWhiteCornerArtifacts(massed);
  const normalized = await applyCircularMask(cornerFixed).catch(() => cornerFixed);

  const png1024 = normalized;
  const png512 = await sharp(source).resize(512, 512, { fit: "cover" }).png().toBuffer();
  const png192 = await sharp(source).resize(192, 192, { fit: "cover" }).png().toBuffer();
  const png180 = await sharp(source).resize(180, 180, { fit: "cover" }).png().toBuffer();
  const png64 = await sharp(source).resize(64, 64, { fit: "cover" }).png().toBuffer();

  const uploads: Array<{ path: string; body: Buffer; contentType: string }> = [
    { path: `${basePath}/icon-1024.png`, body: png1024, contentType: "image/png" },
    { path: `${basePath}/icon-512.png`, body: png512, contentType: "image/png" },
    { path: `${basePath}/icon-192.png`, body: png192, contentType: "image/png" },
    { path: `${basePath}/icon-180.png`, body: png180, contentType: "image/png" },
    { path: `${basePath}/favicon-64.png`, body: png64, contentType: "image/png" },
  ];

  for (const file of uploads) {
    const { error } = await admin.storage.from(LOGO_BUCKET).upload(file.path, file.body, {
      contentType: file.contentType,
      upsert: true,
      cacheControl: "86400",
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }

  const pub = (path: string) => admin.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  const iconOriginalUrl = pub(`${basePath}/icon-1024.png`);
  const icon512Url = pub(`${basePath}/icon-512.png`);
  const icon192Url = pub(`${basePath}/icon-192.png`);
  const faviconUrl = pub(`${basePath}/favicon-64.png`);

  return {
    iconUrl: icon512Url,
    iconOriginalUrl,
    icon512Url,
    icon192Url,
    faviconUrl,
  };
}

/**
 * Polished brand icon from deterministic SVG → PNG (no OpenAI, no Action Credits).
 */
export async function generateBrandIconFromSvg(input: {
  projectId: string;
  operationId: string;
  appName: string;
  category?: string;
}): Promise<LogoGenerationResult> {
  try {
    const svg = generateAppIconSvg(input.appName, input.category);
    const buffer = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer();
    const validated = await validateLogoBuffer(buffer);
    if (!validated.ok) {
      return { ok: false, error: validated.error, providerCostUsd: 0 };
    }
    const urls = await uploadLogoDerivatives(input.projectId, input.operationId, buffer);
    return {
      ok: true,
      urls,
      provider: "dreamos",
      modelId: "brand_svg_v1",
      providerCostUsd: 0,
      width: validated.width,
      height: validated.height,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "brand_svg_failed",
      providerCostUsd: 0,
    };
  }
}

/** OpenAI image only — no silent SVG fallback (caller handles fallback + credits). */
export async function generateAppLogoWithOpenAi(input: {
  projectId: string;
  operationId: string;
  appName: string;
  shortDescription: string;
  category?: string;
}): Promise<LogoGenerationResult> {
  const route = routeImageProvider("image_simple");
  if (!isAiLogoGenerationAvailable()) {
    return { ok: false, error: "openai_not_configured", providerCostUsd: 0 };
  }

  try {
    const prompt = buildLogoPrompt(input);
    let generated = await generateOpenAiLogo(prompt);
    let validated = await validateLogoBuffer(generated.buffer);
    if (!validated.ok) {
      return { ok: false, error: validated.error, providerCostUsd: generated.providerCostUsd };
    }
    let visual = await validateIconVisualQuality(generated.buffer);
    if (!visual.ok) {
      const strictPrompt = `${prompt} CRITICAL: single bold symbolic glyph, NO letters, fills 90% of canvas, no white border.`;
      const retry = await generateOpenAiLogo(strictPrompt);
      const retryValid = await validateLogoBuffer(retry.buffer);
      if (retryValid.ok) {
        const retryVisual = await validateIconVisualQuality(retry.buffer);
        if (retryVisual.ok) {
          generated = retry;
          validated = retryValid;
          visual = retryVisual;
        }
      }
    }
    if (!visual.ok) {
      return { ok: false, error: "icon_visual_validation_failed", providerCostUsd: generated.providerCostUsd };
    }
    const urls = await uploadLogoDerivatives(input.projectId, input.operationId, generated.buffer);
    return {
      ok: true,
      urls,
      provider: route.provider,
      modelId: generated.modelId,
      providerCostUsd: generated.providerCostUsd,
      width: validated.width,
      height: validated.height,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "openai_image_failed",
      providerCostUsd: 0,
    };
  }
}

export async function generateAppLogo(input: {
  projectId: string;
  operationId: string;
  appName: string;
  shortDescription: string;
  category?: string;
}): Promise<LogoGenerationResult> {
  const ai = await generateAppLogoWithOpenAi(input);
  if (ai.ok) return ai;
  return generateBrandIconFromSvg({
    projectId: input.projectId,
    operationId: input.operationId,
    appName: input.appName,
    category: input.category,
  });
}

export function buildFallbackIconSvg(appName: string, category?: string): string {
  return generateAppIconSvg(appName, category);
}
