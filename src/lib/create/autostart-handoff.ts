/** Session handoff for home → /create autostart (not billing/project truth). */

const KEY = "dreamos:create-autostart";

export type AutostartHandoff = {
  prompt: string;
  mode: "discuss" | "edit" | "build";
  idempotencyKey: string;
  createdAt: number;
};

export function storeAutostartHandoff(prompt: string, mode: AutostartHandoff["mode"]): string {
  const idempotencyKey = `as_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const payload: AutostartHandoff = {
    prompt: prompt.trim(),
    mode,
    idempotencyKey,
    createdAt: Date.now(),
  };
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  }
  return idempotencyKey;
}

export function consumeAutostartHandoff(
  promptFromUrl: string,
  modeFromUrl: AutostartHandoff["mode"],
): AutostartHandoff | null {
  const trimmed = promptFromUrl.trim();
  if (!trimmed) return null;

  if (typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AutostartHandoff;
        if (parsed.prompt === trimmed && Date.now() - parsed.createdAt < 10 * 60_000) {
          sessionStorage.removeItem(KEY);
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    const idempotencyKey = `as_url_${hashPrompt(trimmed)}`;
    const consumedKey = `dreamos_autostart_consumed:${idempotencyKey}`;
    if (sessionStorage.getItem(consumedKey) === "1") return null;
    sessionStorage.setItem(consumedKey, "1");
  }

  return {
    prompt: trimmed,
    mode: modeFromUrl,
    idempotencyKey: `as_url_${hashPrompt(trimmed)}`,
    createdAt: Date.now(),
  };
}

function hashPrompt(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
