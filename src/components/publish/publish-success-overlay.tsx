"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { PublishConfetti } from "@/components/publish/publish-confetti";
import { PublishSuccessPanel } from "@/components/publish/publish-success-panel";

export function PublishSuccessOverlay({
  open,
  appName,
  publicUrl,
  subdomainUrl,
  customDomain,
  customDomainHint,
  onDone,
}: {
  open: boolean;
  appName: string;
  publicUrl: string;
  subdomainUrl?: string | null;
  customDomain?: string | null;
  customDomainHint?: string | null;
  onDone: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[25000] flex items-center justify-center p-4">
      <PublishConfetti active={open} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onDone}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="relative z-10 w-full max-w-lg"
        data-testid="publish-success-overlay"
      >
        <PublishSuccessPanel
          appName={appName}
          publicUrl={publicUrl}
          subdomainUrl={subdomainUrl}
          customDomain={customDomain}
          customDomainHint={customDomainHint}
          onClose={onDone}
          className="shadow-2xl"
        />
      </motion.div>
    </div>,
    document.body,
  );
}
