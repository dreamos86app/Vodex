/** Copy text with clipboard API + textarea fallback; never fails silently. */
export async function copyTextToClipboard(text: string): Promise<{ ok: boolean; chars: number }> {
  const chars = text.length;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, chars };
    }
  } catch {
    /* fall through */
  }

  if (typeof document === "undefined") return { ok: false, chars };

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return { ok, chars };
}
