"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  isReferralNoticeKind,
  REFERRAL_NOTICE_QUERY,
  REFERRAL_TOAST_MESSAGES,
} from "@/lib/referrals/referral-messages";

/** Shows referral toasts from ?referral_notice= and strips the query param. */
export function ReferralNoticeHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const kind = searchParams.get(REFERRAL_NOTICE_QUERY);
    if (!isReferralNoticeKind(kind)) return;

    const message = REFERRAL_TOAST_MESSAGES[kind];
    if (kind === "invalid_code") toast.warning(message);
    else if (kind === "saved") toast.info(message);
    else toast.info(message);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(REFERRAL_NOTICE_QUERY);
      const qs = url.searchParams.toString();
      router.replace(qs ? `${url.pathname}?${qs}` : url.pathname);
    } catch {
      /* ignore */
    }
  }, [searchParams, router]);

  return null;
}
