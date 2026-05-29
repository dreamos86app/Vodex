"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { hasActiveSession } from "@/lib/auth/client-identity";
import {
  DREAMOS_REF_STORAGE_KEY,
  clearPendingReferralForBrowser,
} from "@/lib/auth/ref-cookie";
import { captureReferralFromLocationSearch } from "@/lib/auth/oauth-prep";
import { toast } from "@/lib/toast";
import { REFERRAL_TOAST_MESSAGES } from "@/lib/referrals/referral-messages";

/**
 * Logged-out: persist ?ref= for OAuth/email. Logged-in: handled by ReferralGuard.
 * After sign-in: attribute once for new users without an existing referrer.
 */
export function ReferralCapture() {
  const { profile, session, user, loading } = useAuthStore();
  const searchParams = useSearchParams();
  const capturedRef = React.useRef(false);

  React.useEffect(() => {
    if (loading) return;
    if (hasActiveSession(session, user)) return;

    const search = searchParams.toString();
    const query = search ? `?${search}` : window.location.search;
    const code = captureReferralFromLocationSearch(query);
    if (code && !capturedRef.current) {
      capturedRef.current = true;
      toast.info(REFERRAL_TOAST_MESSAGES.saved);
    }
  }, [loading, session, user, searchParams]);

  React.useEffect(() => {
    if (loading) return;
    if (!hasActiveSession(session, user) || !profile?.id) return;

    if ((profile.referred_by ?? "").trim() || profile.onboarding_completed === true) {
      clearPendingReferralForBrowser();
      return;
    }

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(DREAMOS_REF_STORAGE_KEY);
    } catch {
      return;
    }
    if (!stored) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/referrals/attribute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: stored }),
        });
        if (cancelled) return;
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "self_referral") {
          toast.info(REFERRAL_TOAST_MESSAGES.self_referral);
        } else if (body.error === "code_not_found" || body.error === "invalid_code") {
          toast.warning(REFERRAL_TOAST_MESSAGES.invalid_code);
        }
        if (
          res.ok ||
          res.status === 400 ||
          res.status === 404 ||
          res.status === 409
        ) {
          clearPendingReferralForBrowser();
        }
      } catch {
        /* network — retry on next load */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.id, profile?.referred_by, profile?.onboarding_completed, session, user]);

  return null;
}
