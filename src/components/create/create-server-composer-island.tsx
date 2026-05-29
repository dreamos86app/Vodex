"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { composerTextareaClass } from "@/components/ui/composer-shell";
import { composerHasMeaningfulText } from "@/lib/create/composer-text";

const PENDING_PROMPT_KEY = "dreamos:create-pending-prompt";

export function readPendingCreatePrompt(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(PENDING_PROMPT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writePendingCreatePrompt(value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (value.trim()) sessionStorage.setItem(PENDING_PROMPT_KEY, value);
    else sessionStorage.removeItem(PENDING_PROMPT_KEY);
  } catch {
    /* ignore */
  }
}

type CreateServerComposerIslandProps = {
  initialPrompt?: string;
  hidden?: boolean;
  loadingHint?: string | null;
};

/**
 * Lightweight SSR-friendly create shell — visible in first HTML before ImmersiveWorkspace hydrates.
 */
export function CreateServerComposerIsland({
  initialPrompt = "",
  hidden = false,
  loadingHint = null,
}: CreateServerComposerIslandProps) {
  const [text, setText] = React.useState(initialPrompt);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.setAttribute("data-composer-handlers", "true");
    return () => el.removeAttribute("data-composer-handlers");
  }, []);

  React.useEffect(() => {
    writePendingCreatePrompt(text);
  }, [text]);

  const trimmed = text.trim();
  const meaningful = composerHasMeaningfulText(trimmed);
  const domLen = trimmed.length;

  if (hidden) return null;

  return (
    <div
      data-testid="builder-shell"
      data-create-server-shell="true"
      className="flex h-screen w-full flex-col overflow-hidden bg-background"
    >
      <span data-testid="build-mode-active" className="sr-only" aria-hidden>
        build
      </span>
      {loadingHint ? (
        <div
          className="shrink-0 border-b border-border/50 bg-muted/30 px-4 py-2 text-center text-[12px] text-muted-foreground"
          data-testid="create-shell-loading-hint"
        >
          {loadingHint}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col justify-end p-4">
        <div
          data-testid="create-composer-form"
          className={cn(
            "composer-shell relative z-10 rounded-xl border border-border/70 bg-surface shadow-sm",
          )}
        >
          <div className="border-b border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
            Build mode
          </div>
          <textarea
            id="dreamos-composer-prompt-fallback"
            ref={taRef}
            name="composer-prompt"
            data-testid="create-prompt-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Describe the app you want to create…"
            spellCheck
            className={cn(composerTextareaClass, "px-3 pb-1 pt-2.5 text-[13px] leading-relaxed")}
          />
          <div className="flex items-center justify-end gap-2 px-2 pb-2 pt-0.5">
            <button
              type="button"
              data-testid="create-submit-button"
              data-create-build-btn
              data-has-text={meaningful ? "true" : "false"}
              data-disabled-reason={meaningful ? "none" : "empty"}
              data-dom-len={domLen}
              data-state-len={domLen}
              data-live-len={domLen}
              disabled={!meaningful}
              className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              Start building
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
