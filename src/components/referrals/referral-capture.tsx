"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/stores/auth-store";

const STORAGE_KEY = "dreamos-ref-code";

/**
 * Mounted globally. Two responsibilities:
 *
 * 1. If the URL has `?ref=CODE`, persist the code to localStorage so it
 *    survives the auth round-trip.
 * 2. Once the user is authenticated, post the stored code to
 *    /api/referrals/attribute exactly once, then clear it.
 *
 * This is a fire-and-forget effect — it never blocks rendering. We read
 * the URL via window.location.search inside an effect to avoid the
 * Suspense boundary requirement of next/navigation's useSearchParams.
 */
export function ReferralCapture() {
  const { profile } = useAuthStore();

  // (1) Persist incoming code from URL — runs only on the client
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("ref");
      if (!code) return;
      const clean = code.trim().toUpperCase();
      if (clean.length < 6 || clean.length > 16) return;
      window.localStorage.setItem(STORAGE_KEY, clean);
    } catch {}
  }, []);

  // (2) When authenticated, attempt attribution exactly once per code.
  React.useEffect(() => {
    if (!profile?.id) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (!stored) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/referrals/attribute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: stored }),
        });
        if (cancelled) return;
        // Clear regardless of success: a successful attribution should not
        // be retried, and a failed one (invalid code, self-referral) is not
        // worth retrying either.
        if (res.ok || res.status === 400 || res.status === 404) {
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {}
        }
      } catch {
        // Network failure: leave the code in storage for the next page load.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return null;
}
