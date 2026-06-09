import { createDecipheriv } from "node:crypto";
import { supabase } from "./supabase.js";
import { log } from "./logger.js";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer | null {
  const raw =
    process.env.APP_SECRET_ENCRYPTION_KEY?.trim() ??
    process.env.DREAMOS_SECRETS_MASTER_KEY?.trim();
  if (!raw) return null;
  let hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length === 64) {
    return Buffer.from(hex, "hex");
  }
  return null;
}

function unseal(b64: string): string | null {
  const key = masterKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - TAG_LEN);
    const data = buf.subarray(IV_LEN, buf.length - TAG_LEN);
    const decipher = createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const BUILD_SAFE_PREFIXES = ["VITE_", "NEXT_PUBLIC_", "PUBLIC_"];

function isBuildSafeKey(name: string): boolean {
  const u = name.toUpperCase();
  return BUILD_SAFE_PREFIXES.some((p) => u.startsWith(p));
}

/** Load build-safe project secrets for preview npm/vite builds (never log values). */
export async function loadPreviewBuildEnv(
  projectId: string,
): Promise<{ env: Record<string, string>; injectedNames: string[] }> {
  const { data, error } = await supabase
    .from("project_secrets")
    .select("key_name, encrypted_value")
    .eq("project_id", projectId);

  if (error || !data?.length) {
    return { env: {}, injectedNames: [] };
  }

  const env: Record<string, string> = {};
  const injectedNames: string[] = [];

  for (const row of data) {
    const key = String(row.key_name ?? "");
    if (!key || !isBuildSafeKey(key)) continue;
    const sealed = row.encrypted_value as string | null;
    if (!sealed) continue;
    const value = unseal(sealed);
    if (value == null) {
      log("warn", "could not unseal build-safe secret", { key, projectId });
      continue;
    }
    env[key] = value;
    injectedNames.push(key);
  }

  if (injectedNames.length) {
    log("info", "injected build-safe secrets", {
      projectId,
      count: injectedNames.length,
      names: injectedNames,
    });
  }

  return { env, injectedNames };
}
