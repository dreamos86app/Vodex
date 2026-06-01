"use client";

import { RouteErrorPage } from "@/components/dev/route-error-page";

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteErrorPage error={error} unstable_retry={unstable_retry} boundary="root" />
  );
}
