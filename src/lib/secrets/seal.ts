import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getMasterKey(): Buffer {
  const raw =
    process.env.APP_SECRET_ENCRYPTION_KEY?.trim() ??
    process.env.DREAMOS_SECRETS_MASTER_KEY?.trim();
  if (!raw) {
    throw new Error(
      "APP_SECRET_ENCRYPTION_KEY or DREAMOS_SECRETS_MASTER_KEY is not set (256-bit hex secret required)",
    );
  }
  let hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length === 64) {
    return Buffer.from(hex, "hex");
  }
  if (hex.length === 64) {
    try {
      const buf = Buffer.from(hex, "hex");
      if (buf.length === 32) return buf;
    } catch {
      /* fall through */
    }
  }
  throw new Error("DREAMOS_SECRETS_MASTER_KEY must be 64 hex chars (32-byte key)");
}

/** AES-256-GCM seal: base64(iv || ciphertext || tag) */
export function sealSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

export function unsealSecret(b64: string): string {
  const key = getMasterKey();
  const buf = Buffer.from(b64, "base64");
  if (buf.length < IV_LEN + TAG_LEN) throw new Error("Invalid sealed payload");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.length >= TAG_LEN ? buf.subarray(buf.length - TAG_LEN) : Buffer.alloc(0);
  const data = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** @alias Integration secrets API */
export function sealIntegrationSecret(plaintext: string): string {
  return sealSecret(plaintext);
}
