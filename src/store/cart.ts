"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { lineTotal, sumMoney } from "@/lib/format";
import type { GaItem } from "@/lib/analytics";

export type CartItem = {
  /** productId:variantId */
  key: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  category: string;
  size: string;
  unitPrice: number;
  quantity: number;
  image: string | null;
  oilTone: string;
  /** Set by the server sync when the product or size is no longer available. */
  unavailable?: boolean;
};

export type CartLineInput = Omit<CartItem, "key" | "quantity" | "unavailable">;

export const MAX_QTY = 99;

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  lastAddedKey: string | null;
  add: (line: CartLineInput, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  replaceAll: (items: CartItem[]) => void;
};

const keyOf = (productId: string, variantId: string) => `${productId}:${variantId}`;
const clampQty = (q: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(q) || 1));

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      lastAddedKey: null,
      add: (line, quantity = 1) =>
        set((state) => {
          const key = keyOf(line.productId, line.variantId);
          const existing = state.items.find((i) => i.key === key);
          const items = existing
            ? state.items.map((i) =>
                i.key === key ? { ...i, ...line, quantity: clampQty(i.quantity + quantity) } : i,
              )
            : [...state.items, { ...line, key, quantity: clampQty(quantity) }];
          return { items, lastAddedKey: key };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, quantity: clampQty(quantity) } : i)),
        })),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      replaceAll: (items) => set({ items }),
    }),
    {
      name: "varam-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      version: 1,
    },
  ),
);

export function cartTotals(items: CartItem[]) {
  const orderable = items.filter((i) => !i.unavailable);
  return {
    count: orderable.reduce((n, i) => n + i.quantity, 0),
    subtotal: sumMoney(orderable.map((i) => lineTotal(i.unitPrice, i.quantity))),
  };
}

export function toGaItem(i: Pick<CartItem, "productId" | "name" | "category" | "size" | "unitPrice" | "quantity">): GaItem {
  return {
    item_id: i.productId,
    item_name: i.name,
    item_brand: "VARAM",
    item_category: i.category,
    item_variant: i.size,
    price: i.unitPrice,
    quantity: i.quantity,
  };
}
