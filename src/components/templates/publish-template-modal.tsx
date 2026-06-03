"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "SaaS",
  "Mobile",
  "AI",
  "Commerce",
  "Community",
  "Productivity",
  "Other",
] as const;

export function PublishTemplateModal({
  open,
  onClose,
  projectId,
  defaultTitle,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultTitle?: string;
}) {
  const [title, setTitle] = React.useState(defaultTitle ?? "");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<string>(CATEGORIES[0]);
  const [tags, setTags] = React.useState("");
  const [previewUrl, setPreviewUrl] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "unlisted" | "private">("public");
  const [busy, setBusy] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (open && defaultTitle) setTitle(defaultTitle);
  }, [open, defaultTitle]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/templates/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim(),
          category,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12),
          previewImageUrl: previewUrl.trim() || null,
          visibility,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; templateId?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not publish template",
        );
      }
      toast.success("Template published to Community Templates");
      onClose();
      window.location.href = "/templates?tab=community";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99990] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
          onClick={busy ? undefined : onClose}
          data-testid="publish-template-modal"
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold text-foreground">Publish as template</h2>
                <p className="text-[12px] text-muted-foreground">Pro+ · Community Templates</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto px-5 py-4">
              <label className="block text-[12px] font-medium text-muted-foreground">
                Title
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
                />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Description
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
                />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Tags (comma-separated)
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="saas, mobile, ai"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Preview image URL
                <input
                  type="url"
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                />
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">
                Visibility
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "public" | "unlisted" | "private")
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </label>
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-xl bg-surface py-2.5 text-[13px] font-semibold ring-1 ring-border"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-[13px] font-bold text-white",
                  busy && "opacity-70",
                )}
                data-testid="publish-template-submit"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" strokeWidth={1.75} />
                )}
                Publish
              </button>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
