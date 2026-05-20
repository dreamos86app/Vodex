import Link from "next/link";
import { cn } from "@/lib/utils";
import { DreamOS86BrandIcon } from "@/components/brand/dreamos86-brand-icon";

export type DreamOS86BrandLockupVariant = "header" | "sidebar" | "drawer" | "footer";

const VARIANT_STYLES: Record<
  DreamOS86BrandLockupVariant,
  { icon: number; text: string }
> = {
  header: { icon: 26, text: "text-[13px] sm:text-[14px]" },
  sidebar: { icon: 26, text: "text-[13.5px]" },
  drawer: { icon: 28, text: "text-[14px]" },
  footer: { icon: 24, text: "text-[13px]" },
};

export type DreamOS86BrandLockupProps = {
  variant?: DreamOS86BrandLockupVariant;
  className?: string;
  href?: string;
  showText?: boolean;
  priority?: boolean;
  onClick?: () => void;
};

/**
 * DreamOS86 platform mark: transparent cloud + wordmark. Not for user/project icons.
 */
export function DreamOS86BrandLockup({
  variant = "header",
  className,
  href = "/",
  showText = true,
  priority = false,
  onClick,
}: DreamOS86BrandLockupProps) {
  const styles = VARIANT_STYLES[variant];
  const inner = (
    <>
      <DreamOS86BrandIcon size={styles.icon} alt="" priority={priority} />
      {showText && (
        <span
          className={cn(
            "truncate font-semibold tracking-[-0.03em] text-foreground",
            styles.text,
          )}
        >
          DreamOS86
        </span>
      )}
    </>
  );

  const rootClass = cn(
    "flex min-w-0 shrink items-center gap-1",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={rootClass}
        aria-label="DreamOS86 home"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={rootClass} onClick={onClick} role={onClick ? "button" : undefined}>
      {inner}
    </div>
  );
}
