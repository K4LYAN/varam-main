"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ConsentValue = "granted" | "denied" | null;

type ConsentState = {
  analytics: ConsentValue;
  bannerOpen: boolean;
  setAnalytics: (v: Exclude<ConsentValue, null>) => void;
  openBanner: () => void;
};

export const useConsent = create<ConsentState>()(
  persist(
    (set) => ({
      analytics: null,
      bannerOpen: false,
      setAnalytics: (v) => set({ analytics: v, bannerOpen: false }),
      openBanner: () => set({ bannerOpen: true }),
    }),
    {
      name: "varam-consent-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ analytics: s.analytics }),
    },
  ),
);
