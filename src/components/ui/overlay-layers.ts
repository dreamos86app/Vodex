/**
 * Canonical Vodex overlay z-index layers (P1.3.12).
 * All overlays must use these tokens — never hardcoded z-index values.
 */

export const OVERLAY_LAYER_CSS_VARS = {
  base: "--z-base",
  dropdown: "--z-dropdown",
  popover: "--z-popover",
  tooltip: "--z-tooltip",
  contextMenu: "--z-context-menu",
  sheet: "--z-sheet",
  dialogBackdrop: "--z-dialog-backdrop",
  dialog: "--z-dialog",
  confirmation: "--z-confirmation",
  commandPalette: "--z-command-palette",
  criticalAlert: "--z-critical-alert",
  toast: "--z-toast",
  debug: "--z-debug",
  /** @deprecated Use dialogBackdrop */
  modalBackdrop: "--z-modal-backdrop",
  /** @deprecated Use dialog */
  modal: "--z-modal",
  /** @deprecated Use sheet */
  drawer: "--z-drawer",
} as const;

export type OverlayLayerKey = keyof typeof OVERLAY_LAYER_CSS_VARS;

/** Tailwind class for a canonical overlay layer. */
export function overlayZClass(layer: OverlayLayerKey): string {
  return `z-[var(${OVERLAY_LAYER_CSS_VARS[layer]})]`;
}

/** Shared menu surface styles — all floating menus use this. */
export const OVERLAY_MENU_SURFACE_CLASS =
  "overflow-hidden rounded-xl border border-border/80 bg-background/95 shadow-xl backdrop-blur-[8px] ring-1 ring-border/60";

/** Shared dialog panel surface. */
export const OVERLAY_DIALOG_PANEL_CLASS =
  "overflow-hidden rounded-[var(--radius-xl)] bg-background shadow-2xl ring-1 ring-border";

/** Shared dialog backdrop. */
export const OVERLAY_DIALOG_BACKDROP_CLASS =
  "fixed inset-0 bg-foreground/30 backdrop-blur-sm";
