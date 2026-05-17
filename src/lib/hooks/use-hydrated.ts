"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns `true` once the component has mounted on the client.
 * Server snapshot is `false`, client snapshot is `true`. React reconciles
 * the change deterministically post-hydration so no mismatch warning fires.
 *
 * Use any time a render depends on `window`, `localStorage`, `next-themes`,
 * persisted Zustand state, or any other client-only value.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
