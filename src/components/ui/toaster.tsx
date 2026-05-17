"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { toast, type ToastItem, type ToastVariant } from "@/lib/toast";
import { cn } from "@/lib/utils";

const META: Record<ToastVariant, { Icon: React.ElementType; cls: string; iconCls: string }> = {
  success: {
    Icon: CheckCircle2,
    cls: "border-positive/25 bg-positive/8",
    iconCls: "text-positive",
  },
  error: {
    Icon: XCircle,
    cls: "border-red-500/25 bg-red-500/8",
    iconCls: "text-red-500",
  },
  info: {
    Icon: Info,
    cls: "border-accent/25 bg-accent/8",
    iconCls: "text-accent",
  },
  warning: {
    Icon: AlertTriangle,
    cls: "border-amber-500/25 bg-amber-500/8",
    iconCls: "text-amber-500",
  },
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { Icon, cls, iconCls } = META[item.variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex min-w-[260px] max-w-[380px] items-start gap-3 rounded-[var(--radius-lg)]",
        "border bg-background/95 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur-xl",
        cls,
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconCls)} strokeWidth={2.2} />
      <p className="flex-1 text-[13px] font-medium leading-snug text-foreground">
        {item.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="cursor-pointer rounded p-0.5 text-muted-foreground/60 transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const [mounted, setMounted] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    setMounted(true);
    const unsub = toast.subscribe(setToasts);
    return () => { unsub(); };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2"
    >
      <AnimatePresence initial={false} mode="sync">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast item={t} onDismiss={() => toast.dismiss(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
