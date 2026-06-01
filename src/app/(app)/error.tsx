"use client";

import { RouteErrorPage } from "@/components/dev/route-error-page";

export default function AppError({
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
      boundary="app"
      title="Page failed to load"
      description="Something unexpected happened while rendering this section. Your data and projects are safe."
    />
  );
}
