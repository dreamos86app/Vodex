"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MoreHorizontal,
  ExternalLink,
  Hammer,
  MonitorPlay,
  Share2,
  Pencil,
  Copy,
  Settings,
  FolderInput,
  Star,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { DestructiveActionModal } from "@/components/security/destructive-action-modal";

type MenuItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export function ProjectCardOverflowMenu({
  projectId,
  appName,
  previewUrl,
  publicUrl,
  isFavorite,
  onToggleFavorite,
  onRenamed,
  onDeleted,
}: {
  projectId: string;
  appName: string;
  previewUrl?: string | null;
  publicUrl?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: (next: boolean) => void;
  onRenamed?: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [exportBusy, setExportBusy] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(appName);
  const [busy, setBusy] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 220) });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function shareApp() {
    const url = publicUrl ?? previewUrl ?? `${window.location.origin}/apps/${projectId}/builder`;
    try {
      if (navigator.share) {
        await navigator.share({ title: appName, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      toast.error("Could not share");
    }
    setOpen(false);
  }

  async function cloneApp() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/clone`, { method: "POST", credentials: "include" });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) throw new Error(body.error ?? "Clone failed");
      toast.success("App cloned");
      router.push(`/apps/${body.id}/builder`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function saveRename() {
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_name: name }),
      });
      if (!res.ok) throw new Error("Rename failed");
      toast.success("App renamed");
      onRenamed?.();
      setRenameOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportZip() {
    setExportBusy(true);
    try {
      const res = await fetch("/api/deploy/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${appName.replace(/\s+/g, "-").toLowerCase()}-export.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportBusy(false);
      setOpen(false);
    }
  }

  const items: MenuItem[] = [
    ...(publicUrl
      ? [{ id: "live", label: "View live app", icon: ExternalLink, href: publicUrl }]
      : []),
    { id: "builder", label: "Open builder", icon: Hammer, href: `/apps/${projectId}/builder` },
    ...(previewUrl
      ? [{ id: "preview", label: "Preview", icon: MonitorPlay, href: previewUrl }]
      : []),
    { id: "share", label: "Share", icon: Share2, onClick: () => void shareApp() },
    { id: "rename", label: "Rename", icon: Pencil, onClick: () => { setRenameOpen(true); setOpen(false); } },
    { id: "clone", label: "Clone app", icon: Copy, onClick: () => void cloneApp(), disabled: busy },
    {
      id: "settings",
      label: "App settings",
      icon: Settings,
      href: `/apps/${projectId}/builder?tab=dashboard&section=settings`,
    },
    {
      id: "folder",
      label: "Move to folder",
      icon: FolderInput,
      onClick: () => { toast.info("Folders coming soon"); setOpen(false); },
    },
    {
      id: "favorite",
      label: isFavorite ? "Remove favorite" : "Favorite",
      icon: Star,
      onClick: () => { onToggleFavorite?.(!isFavorite); setOpen(false); },
    },
    {
      id: "export",
      label: "Export / download",
      icon: Download,
      onClick: () => void exportZip(),
      disabled: exportBusy,
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onClick: () => { setDeleteOpen(true); setOpen(false); },
    },
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Actions for ${appName}`}
        aria-expanded={open}
        data-testid="project-card-overflow-menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "relative z-[2] flex size-8 cursor-pointer items-center justify-center rounded-lg ring-1 transition",
          "bg-background text-accent ring-border hover:bg-accent hover:text-white hover:ring-accent/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
          open && "bg-accent text-white ring-accent",
        )}
      >
        <MoreHorizontal className="size-4" strokeWidth={2.25} />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open ? (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                style={{ top: pos.top, left: pos.left }}
                className="fixed z-[var(--z-popover)] w-[220px] overflow-hidden rounded-xl bg-background shadow-xl ring-1 ring-border"
                data-testid="project-card-overflow-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                <ul className="py-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const cls = cn(
                      "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium transition",
                      "hover:bg-accent/8 focus-visible:bg-accent/8 focus-visible:outline-none",
                      item.destructive ? "text-destructive hover:bg-destructive/8" : "text-foreground",
                      item.disabled && "pointer-events-none opacity-50",
                    );
                    if (item.href) {
                      return (
                        <li key={item.id}>
                          <Link href={item.href} className={cls} onClick={() => setOpen(false)}>
                            <Icon className="size-3.5 shrink-0" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <li key={item.id}>
                        <button type="button" className={cls} onClick={item.onClick} disabled={item.disabled}>
                          <Icon className="size-3.5 shrink-0" />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )}

      {renameOpen ? (
        <div
          className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
          onClick={() => setRenameOpen(false)}
        >
          <div
            className="z-[var(--z-modal)] w-full max-w-sm rounded-xl bg-background p-5 shadow-xl ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[14px] font-semibold">Rename app</p>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 ring-border" onClick={() => setRenameOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
                onClick={() => void saveRename()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DestructiveActionModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        actionType="delete_project"
        targetId={projectId}
        targetName={appName}
        onVerifiedDelete={async (verificationId) => {
          setBusy(true);
          try {
            const res = await fetch(`/api/projects/${projectId}/delete-secure`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ verificationId, actionType: "delete_project" }),
            });
            const json = (await res.json()) as { error?: string };
            if (!res.ok) throw new Error(json.error ?? "Delete failed");
            toast.success("App deleted");
            onDeleted?.();
            setDeleteOpen(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
