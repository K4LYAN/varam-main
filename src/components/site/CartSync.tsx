"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";

type SyncLine = {
  productId: string;
  variantId: string;
  found: boolean;
  available: boolean;
  name?: string;
  slug?: string;
  size?: string;
  price?: number;
  image?: string | null;
  oilTone?: string;
  category?: string;
};

/**
 * Re-validates the persisted cart against the live catalogue once per visit
 * so prices, names and availability are always current (the admin may have
 * changed them since the item was added).
 */
export function CartSync() {
  useEffect(() => {
    const items = useCart.getState().items;
    if (!items.length) return;
    const controller = new AbortController();
    fetch("/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: items.map((i) => ({ productId: i.productId, variantId: i.variantId })) }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lines: SyncLine[] } | null) => {
        if (!data) return;
        const byKey = new Map(data.lines.map((l) => [`${l.productId}:${l.variantId}`, l]));
        const current = useCart.getState().items;
        useCart.getState().replaceAll(
          current.map((item) => {
            const live = byKey.get(item.key);
            if (!live) return item;
            if (!live.found || !live.available) return { ...item, unavailable: true };
            return {
              ...item,
              unavailable: false,
              name: live.name ?? item.name,
              slug: live.slug ?? item.slug,
              size: live.size ?? item.size,
              unitPrice: live.price ?? item.unitPrice,
              image: live.image ?? null,
              oilTone: live.oilTone ?? item.oilTone,
              category: live.category ?? item.category,
            };
          }),
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return null;
}
