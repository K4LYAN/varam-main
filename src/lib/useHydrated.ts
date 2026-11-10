"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after the first client render — avoids hydration mismatches for localStorage-backed UI. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
