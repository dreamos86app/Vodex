"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { VodexImportantLinksFooter } from "@/components/layout/vodex-important-links-footer";

/** Only hide footer where it breaks immersive UX (not /apps list or admin). */
const HIDE_PREFIXES = ["/create", "/auth", "/onboarding", "/builder"];

export function DeferredFooter() {
  const pathname = usePathname();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setReady(false);
    const t = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const hidden = HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  if (hidden || !ready) return null;

  return <VodexImportantLinksFooter />;
}
