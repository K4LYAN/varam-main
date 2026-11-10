"use client";

import { useCallback } from "react";
import { toGaItem, useCart } from "@/store/cart";
import { analytics } from "@/lib/analytics";
import { toast } from "@/store/toast";
import { useIsland } from "@/store/island";
import type { Product, Variant } from "@/lib/types";

export function useAddToCart() {
  const add = useCart((s) => s.add);
  const showIsland = useIsland((s) => s.show);

  return useCallback(
    (product: Product, variant: Variant, quantity = 1) => {
      if (!product.available || !variant.available) {
        toast({ title: "Currently unavailable", description: "Please choose another size or check back soon.", tone: "warning" });
        return;
      }
      const line = {
        productId: product.id,
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        category: product.categoryName,
        size: variant.label,
        unitPrice: variant.price,
        image: product.images[0] ?? null,
        oilTone: product.oilTone,
      };
      add(line, quantity);
      analytics.addToCart(toGaItem({ ...line, quantity }));
      // "Live activity" in the Dynamic Island nav
      showIsland({
        title: "Added to cart",
        subtitle: `${product.name.replace(/^Cold-Pressed /, "")} · ${variant.label}${quantity > 1 ? ` × ${quantity}` : ""}`,
        name: product.name,
        image: product.images[0] ?? null,
        oilTone: product.oilTone,
      });
    },
    [add, showIsland],
  );
}

export function defaultVariant(product: Product): Variant | undefined {
  return product.variants.find((v) => v.available) ?? product.variants[0];
}
