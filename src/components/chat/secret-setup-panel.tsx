"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ImportedSecretsSetupPanel } from "@/components/import/imported-secrets-setup-panel";
import { cn } from "@/lib/utils";

/**
 * In-chat secret setup — shown after the secrets AI assistant flow starts.
 * Never asks users to paste secrets as plain chat text.
 */
export function SecretSetupPanel({
  projectId,
  envRequirements,
  className,
  onSaved,
  onClose,
  onSkipOptional,
}: {
  projectId: string;
  envRequirements: unknown;
  className?: string;
  onSaved?: () => void;
  onClose?: () => void;
  onSkipOptional?: () => void;
}) {
  return (
    <div
      data-testid="secret-setup-panel"
      className={cn(
        "mt-3 rounded-2xl border border-accent/25 bg-surface/95 p-4 shadow-sm ring-1 ring-accent/15",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Connect required secrets</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Save each key securely below — values are encrypted and never shown in chat.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="Close secret setup"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <ImportedSecretsSetupPanel
        projectId={projectId}
        envRequirements={envRequirements}
        onSaved={onSaved}
      />
      {onSkipOptional ? (
        <button
          type="button"
          onClick={onSkipOptional}
          className="mt-3 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Skip optional secrets for now
        </button>
      ) : null}
    </div>
  );
}
