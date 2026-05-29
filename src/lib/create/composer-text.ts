/** Canonical composer text + submit enablement (create workspace). */

export type ComposerDisabledReason = "none" | "empty" | "auth" | "credits" | "queue_full" | "error";

export function composerHasMeaningfulText(text: string): boolean {
  return text.trim().length > 0;
}

/** Canonical composer text: React state → textarea ref → form field. */
export function getComposerText(sources: {
  stateText?: string;
  textareaEl?: HTMLTextAreaElement | null;
  formEl?: HTMLFormElement | null;
  fieldName?: string;
}): string {
  return getComposerTextFromSources(sources);
}

export function getComposerTextFromSources(sources: {
  stateText?: string;
  textareaEl?: HTMLTextAreaElement | null;
  formEl?: HTMLFormElement | null;
  fieldName?: string;
}): string {
  const fromState = sources.stateText ?? "";
  const fromRef = sources.textareaEl?.value ?? "";
  let fromForm = "";
  if (sources.formEl && sources.fieldName) {
    const raw = new FormData(sources.formEl).get(sources.fieldName);
    if (typeof raw === "string") fromForm = raw;
  }
  const candidates = [fromState, fromRef, fromForm];
  const meaningful = candidates.filter((t) => composerHasMeaningfulText(t));
  if (meaningful.length > 0) {
    return meaningful.reduce((best, cur) => (cur.length > best.length ? cur : best), "");
  }
  return candidates.reduce((best, cur) => (cur.length > best.length ? cur : best), "");
}

export function resolveComposerSubmitDisabledReason(input: {
  text: string;
  hydrated: boolean;
  userId: string | null | undefined;
  creditError: boolean;
  creditsLoading: boolean;
  /** When false, build credits have not been confirmed from the API yet — do not block submit. */
  creditsConfirmed?: boolean;
  buildCreditsAvailable: number;
  buildJobActive: boolean;
  queueCount: number;
  queueMax: number;
  fatalError: boolean;
}): ComposerDisabledReason {
  if (input.fatalError) return "error";
  if (input.hydrated && !input.userId) return "auth";
  if (input.creditError) return "credits";
  const creditsKnown = input.creditsConfirmed === true && !input.creditsLoading;
  if (input.hydrated && creditsKnown && input.buildCreditsAvailable <= 0) {
    return "credits";
  }
  if (input.queueCount >= input.queueMax) return "queue_full";
  if (!composerHasMeaningfulText(input.text)) return "empty";
  return "none";
}

export function canSubmitComposer(reason: ComposerDisabledReason): boolean {
  return reason === "none";
}
