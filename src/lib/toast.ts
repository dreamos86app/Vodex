export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

type Listener = (toasts: ToastItem[]) => void;

const listeners = new Set<Listener>();
let _toasts: ToastItem[] = [];

function notify() {
  const copy = [..._toasts];
  listeners.forEach((l) => l(copy));
}

function dismiss(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id);
  notify();
}

function show(message: string, variant: ToastVariant): string {
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  // Keep max 4 visible
  _toasts = [..._toasts.slice(-3), { id, message, variant }];
  notify();
  setTimeout(() => dismiss(id), 4200);
  return id;
}

export const toast = {
  success: (message: string) => show(message, "success"),
  error: (message: string) => show(message, "error"),
  info: (message: string) => show(message, "info"),
  warning: (message: string) => show(message, "warning"),
  dismiss,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
