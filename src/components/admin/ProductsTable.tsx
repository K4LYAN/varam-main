"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { deleteProduct, setProductFlag } from "@/app/admin/actions";
import { ProductImage } from "@/components/product/ProductImage";
import { toast } from "@/store/toast";
import { Toggle } from "./ui";

export function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const list = useMemo(
    () => products.filter((p) => `${p.name} ${p.categoryName}`.toLowerCase().includes(q.toLowerCase())),
    [products, q],
  );

  const flag = (p: Product, field: "available" | "featured" | "is_new", value: boolean) =>
    start(async () => {
      const res = await setProductFlag(p.id, field, value);
      if (!res.ok) toast({ title: "Could not update", description: res.error, tone: "warning" });
      router.refresh();
    });

  const remove = (p: Product) => {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.\n\nTip: switch off “Available” instead to hide it temporarily.`)) return;
    start(async () => {
      const res = await deleteProduct(p.id);
      toast(res.ok ? { title: "Product deleted" } : { title: "Could not delete", description: res.error, tone: "warning" });
      router.refresh();
    });
  };

  return (
    <div className={pending ? "opacity-70 transition" : "transition"}>
      <label className="relative mb-4 block max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="field pl-9" />
      </label>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-[11px] tracking-[0.12em] text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Sizes &amp; prices</th>
              <th className="px-4 py-3 font-semibold">Available</th>
              <th className="px-4 py-3 font-semibold">Featured</th>
              <th className="px-4 py-3 font-semibold">New</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((p) => (
              <tr key={p.id} className="align-middle">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md bg-cream">
                      <ProductImage name={p.name} image={p.images[0]} oilTone={p.oilTone} sizes="44px" />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/admin/products/${p.id}`} className="font-semibold hover:text-brand">
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted">{p.categoryName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {p.variants.map((v) => (
                    <span key={v.id} className={`mr-2 inline-block whitespace-nowrap ${v.available ? "" : "line-through"}`}>
                      {v.label}: <span className="text-ink tabular-nums">{formatINR(v.price)}</span>
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <Toggle checked={p.available} onChange={(v) => flag(p, "available", v)} label="" ariaLabel={`Available: ${p.name}`} />
                </td>
                <td className="px-4 py-3">
                  <Toggle checked={p.featured} onChange={(v) => flag(p, "featured", v)} label="" ariaLabel={`Featured: ${p.name}`} />
                </td>
                <td className="px-4 py-3">
                  <Toggle checked={p.isNew} onChange={(v) => flag(p, "is_new", v)} label="" ariaLabel={`New arrival: ${p.name}`} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link href={`/admin/products/${p.id}`} className="inline-grid h-9 w-9 place-items-center rounded-full hover:bg-cream" aria-label={`Edit ${p.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button onClick={() => remove(p)} className="inline-grid h-9 w-9 place-items-center rounded-full text-copper hover:bg-copper/10" aria-label={`Delete ${p.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
