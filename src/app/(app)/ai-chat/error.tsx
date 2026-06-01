"use client";

import { RouteErrorPage } from "@/components/dev/route-error-page";

export default function AiChatError({
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
      boundary="ai-chat"
      title="Chat failed to load"
    />
  );
}
