"use client";

import { create } from "zustand";

export type Toast = {
  id: number;
  title: string;
  description?: string;
  tone?: "default" | "success" | "warning";
  action?: { label: string; onClick: () => void };
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
};

let counter = 0;

export const useToast = create<ToastState>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (t: Omit<Toast, "id">) => useToast.getState().push(t);
