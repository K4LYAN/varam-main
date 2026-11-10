"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Eye, Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { analytics } from "@/lib/analytics";
import { ProductImage } from "./ProductImage";
import { SizeSelector } from "./SizeSelector";
import { defaultVariant, useAddToCart } from "./useAddToCart";

export function ProductCard({
  product,
  index = 0,
  list = { id: "all_oils", name: "All Oils" },
  onQuickView,
  priority,
}: {
  product: Product;
  index?: number;
  list?: { id: string; name: string };
  onQuickView?: (p: Product) => void;
  priority?: boolean;
}) {
  const initial = defaultVariant(product);
  const [variantId, setVariantId] = useState(initial?.id ?? "");
  const variant = product.variants.find((v) => v.id === variantId) ?? initial;
  const addToCart = useAddToCart();
  const href = `/oils/${product.slug}`;
  const soldOut = !product.available || !product.variants.some((v) => v.available);
  const multiSize = product.variants.length > 1;

  const select = () =>
    analytics.selectItem(list.id, list.name, {
      item_id: product.id,
      item_name: product.name,
      item_brand: "VARAM",
      item_category: product.categoryName,
      item_variant: variant?.label,
      price: variant?.price,
      index,
    });

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: (index % 4) * 0.07 }}
      className="group flex flex-col rounded-[1.4rem] border border-line bg-white/70 p-2 transition-[box-shadow,border-color,transform] duration-500 hover:-translate-y-1 hover:border-sand hover:shadow-[0_24px_50px_-28px_rgba(61,31,14,0.45)] sm:rounded-[1.75rem] sm:p-3"
      data-product={product.slug}
    >
      <div className="relative">
        <Link
          href={href}
          onClick={select}
          className="relative block aspect-[4/5] overflow-hidden rounded-[1.05rem] sm:rounded-[1.25rem]"
          aria-label={product.name}
        >
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_32%,#fffaf1_0%,#f8eedb_55%,#f0debe_100%)]"
            aria-hidden="true"
          />
          <div className="absolute inset-0 transition-transform duration-[1.2s] ease-[var(--ease-luxe)] group-hover:scale-[1.05]">
            <ProductImage
              name={product.name}
              image={product.images[0]}
              oilTone={product.oilTone}
              size={variant?.label}
              priority={priority}
              sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 50vw"
              bottleClassName="h-[80%] -translate-y-[6%] drop-shadow-[0_24px_24px_rgba(61,31,14,0.2)]"
            />
          </div>
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 sm:top-3.5 sm:left-3.5">
            {product.isNew && (
              <span className="rounded-full bg-leaf px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-ivory uppercase sm:px-2.5 sm:py-1 sm:text-[10px]">
                New
              </span>
            )}
            {product.featured && !product.isNew && (
              <span className="rounded-full bg-ivory/90 px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-brand uppercase backdrop-blur sm:px-2.5 sm:py-1 sm:text-[10px]">
                Bestseller
              </span>
            )}
            {soldOut && (
              <span className="rounded-full bg-ink/85 px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-ivory uppercase sm:px-2.5 sm:py-1 sm:text-[10px]">
                Out of stock
              </span>
            )}
          </div>
        </Link>
        {onQuickView && (
          <button
            onClick={() => {
              select();
              onQuickView(product);
            }}
            className="absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-ivory/90 text-ink shadow-sm backdrop-blur transition duration-500 hover:bg-ivory sm:top-3 sm:right-3 sm:h-10 sm:w-10 lg:translate-y-1 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            aria-label={`Quick view ${product.name}`}
          >
            <Eye className="h-4 w-4" strokeWidth={1.6} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1.5 pt-3.5 pb-1 sm:px-2.5 sm:pt-5 sm:pb-2">
        <p className="eyebrow text-[9px] sm:text-[10px]">{product.categoryName}</p>
        <h3 className="mt-1.5 font-serif text-[1.15rem] leading-[1.1] sm:mt-2 sm:text-[1.6rem] sm:leading-[1.05]">
          <Link href={href} onClick={select} className="line-clamp-2 hover:text-brand">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted max-sm:hidden">{product.shortDescription}</p>

        {multiSize && (
          <div className="mt-3 sm:mt-4">
            <SizeSelector variants={product.variants} value={variantId} onChange={setVariantId} name={product.name} />
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:pt-5">
          <div className="min-w-0">
            <p className="font-serif text-xl leading-none tabular-nums sm:text-[1.7rem]" aria-live="polite">
              {variant ? formatINR(variant.price) : "—"}
            </p>
            {variant && <p className="mt-1 text-[11px] text-muted sm:text-xs">per {variant.label}</p>}
          </div>
          <button
            onClick={() => variant && addToCart(product, variant)}
            disabled={soldOut || !variant?.available}
            className="btn btn-primary min-h-10 shrink-0 px-3 sm:min-h-11 sm:px-4"
            aria-label={`Add ${product.name} ${variant?.label ?? ""} to cart`}
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
