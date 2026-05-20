import { DreamOS86BrandIcon } from "@/components/brand/dreamos86-brand-icon";

/**
 * @deprecated Prefer `DreamOS86BrandIcon` — kept for existing imports.
 * DreamOS86 platform logo only (not user or generated app icons).
 */
export function LogoIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <DreamOS86BrandIcon size={size} className={className} priority />;
}
