import type { Metadata } from "next";
import { Suspense } from "react";
import { TemplatesView } from "@/components/templates/templates-view";

export const metadata: Metadata = {
  title: "Templates",
};

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl py-12 text-muted-foreground">Loading templates…</div>}>
      <TemplatesView />
    </Suspense>
  );
}
