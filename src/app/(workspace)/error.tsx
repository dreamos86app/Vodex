"use client";

import { RouteErrorPage } from "@/components/dev/route-error-page";

/** Builder / create workspace — errors must show owner diagnostics inline (no shell chrome). */
export default function WorkspaceError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteErrorPage
      error={error}
      unstable_retry={unstable_retry}
      boundary="workspace"
      title="Builder failed to load"
      description="The workspace hit a rendering error. Your project and files are safe. Retry or copy the fix prompt below (owner)."
    />
  );
}
