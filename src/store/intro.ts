"use client";

import { create } from "zustand";

/** `ready` flips to true once the loading screen has lifted (or was skipped). */
export const useIntro = create<{ ready: boolean; setReady: () => void }>()((set) => ({
  ready: false,
  setReady: () => set({ ready: true }),
}));
