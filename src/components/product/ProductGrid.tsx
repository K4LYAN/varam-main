"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import type { Product } from "@/lib/types";
import { analytics } from "@/lib/analytics";
import { ProductCard } from "./ProductCard";
import { QuickView } from "./QuickView";

export function toListItems(products: Product[], list: { id: string; name: string }) {
  return products.map((p, i) => ({
    item_id: p.id,
    item_name: p.name,
    item_brand: "VARAM",
    item_category: p.categoryName,
    price: p.variants[0]?.price,
    index: i,
    item_list_id: list.id,
    item_list_name: list.name,
  }));
}

export function ProductGrid({
  products,
  list,
  className,
  priorityCount = 0,
}: {
  products: Product[];
  list: { id: string; name: string };
  className?: string;
  priorityCount?: number;
}) {
  const [quick, setQuick] = useState<Product | null>(null);
  const ids = products.map((p) => p.id).join(",");

  useEffect(() => {
    if (products.length) analytics.viewItemList(list.id, list.name, toListItems(products, list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, list.id]);

  return (
    <>
      <div className={clsx("grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4", className)}>
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} list={list} onQuickView={setQuick} priority={i < priorityCount} />
        ))}
      </div>
      <QuickView product={quick} onClose={() => setQuick(null)} />
    </>
  );
}
