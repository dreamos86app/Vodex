"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ImageIcon,
  X,
  FileArchive,
  GitBranch,
  Frame,
  Link as LinkIcon,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AttachmentKind = "image" | "file" | "zip" | "github" | "figma" | "url";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  /** Display name (filename, repo slug, URL host) */
  name: string;
  /** For images/files only */
  file?: File;
  /** For images: object URL for preview thumbnail */
  previewUrl?: string;
  /** For URL/GitHub/Figma imports */
  externalUrl?: string;
  /** Bytes — undefined for URL imports */
  size?: number;
  /** "parsing" while the AI is reading it; "ready" when chip should render normally */
  status?: "ready" | "parsing" | "error";
  errorMessage?: string;
}

const KIND_ICON: Record<AttachmentKind, React.ElementType> = {
  image: ImageIcon,
  file: FileText,
  zip: FileArchive,
  github: GitBranch,
  figma: Frame,
  url: LinkIcon,
};

function formatBytes(bytes?: number) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface AttachmentRailProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  className?: string;
}

export function AttachmentRail({
  attachments,
  onRemove,
  className,
}: AttachmentRailProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <AnimatePresence initial={false}>
        {attachments.map((a) => {
          const Icon = KIND_ICON[a.kind];
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "group relative flex items-center gap-2 rounded-lg bg-surface py-1.5 pl-2 pr-1.5 text-[12px] ring-1 transition",
                a.status === "error"
                  ? "ring-destructive/40"
                  : "ring-border hover:ring-border-strong",
              )}
            >
              {a.kind === "image" && a.previewUrl ? (
                <div className="relative size-6 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image
                    src={a.previewUrl}
                    alt={a.name}
                    fill
                    sizes="24px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-3.5" strokeWidth={1.65} />
                </div>
              )}

              <div className="flex flex-col leading-tight">
                <span className="max-w-[180px] truncate font-medium text-foreground">
                  {a.name}
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  {a.status === "parsing"
                    ? "Reading…"
                    : a.status === "error"
                      ? a.errorMessage ?? "Failed to read"
                      : a.size
                        ? formatBytes(a.size)
                        : a.externalUrl
                          ? new URL(a.externalUrl).host
                          : ""}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onRemove(a.id)}
                aria-label={`Remove ${a.name}`}
                className="ml-1 flex size-5 items-center justify-center rounded text-muted-foreground/70 transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" strokeWidth={2} />
              </button>

              {a.status === "parsing" && (
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                  <span className="absolute inset-y-0 -left-full w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[shimmer_1.6s_linear_infinite]" />
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─── Drop zone wrapper ────────────────────────────────────────────────────────

export interface DropZoneProps {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
  /** Disable drop handling (e.g. while a request is in-flight) */
  disabled?: boolean;
}

export function DropZone({
  onFiles,
  children,
  className,
  disabled,
}: DropZoneProps) {
  const [over, setOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  const onDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      dragCounter.current += 1;
      setOver(true);
    },
    [disabled],
  );

  const onDragLeave = React.useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setOver(false);
    }
  }, [disabled]);

  const onDragOver = React.useCallback((e: React.DragEvent) => {
    if (disabled) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, [disabled]);

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragCounter.current = 0;
      setOver(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("relative", className)}
    >
      {children}

      <AnimatePresence>
        {over && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-[inherit] bg-accent/10 ring-2 ring-accent ring-offset-0 backdrop-blur-[1px]"
          >
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/90 px-5 py-4 text-center shadow-[var(--shadow-md)] ring-1 ring-border">
              <UploadCloud
                className="size-6 text-accent"
                strokeWidth={1.65}
              />
              <p className="text-[13px] font-semibold text-foreground">
                Drop to attach
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                Images, files, ZIPs — DreamOS86 will parse them.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
