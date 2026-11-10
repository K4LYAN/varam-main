"use client";

import { create } from "zustand";

export type IslandNotice = {
  id: number;
  title: string;
  subtitle: string;
  name: string;
  image: string | null;
  oilTone: string;
};

type IslandState = {
  notice: IslandNotice | null;
  show: (n: Omit<IslandNotice, "id">) => void;
  clear: () => void;
};

let counter = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Transient "live activity" shown inside the Dynamic Island nav (e.g. added to cart). */
export const useIsland = create<IslandState>()((set) => ({
  notice: null,
  show: (n) => {
    const id = ++counter;
    set({ notice: { ...n, id } });
    clearTimeout(timer);
    timer = setTimeout(() => set((s) => (s.notice?.id === id ? { notice: null } : s)), 3200);
  },
  clear: () => set({ notice: null }),
}));
