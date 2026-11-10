"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { analytics } from "@/lib/analytics";
import { QtyStepper } from "@/components/site/CartDrawer";
import { ProductImage } from "./ProductImage";
import { SizeSelector } from "./SizeSelector";
import { defaultVariant, useAddToCart } from "./useAddToCart";

export function QuickView({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {product && <QuickViewInner key={product.id} product={product} onClose={onClose} />}
    </AnimatePresence>
  );
}

function QuickViewInner({ product, onClose }: { product: Product; onClose: () => void }) {
  const initial = defaultVariant(product);
  const [variantId, setVariantId] = useState(initial?.id ?? "");
  const [qty, setQty] = useState(1);
  const variant = product.variants.find((v) => v.id === variantId) ?? initial;
  const addToCart = useAddToCart();

  useEffect(() => {
    analytics.viewItem({
      item_id: product.id,
      item_name: product.name,
      item_brand: "VARAM",
      item_category: product.categoryName,
      item_variant: initial?.label,
      price: initial?.price,
      quantity: 1,
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={product.name}>
      <motion.button
        aria-label="Close quick view"
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-ivory sm:grid-cols-2 sm:rounded-3xl"
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-ivory/80 backdrop-blur hover:bg-cream" aria-label="Close">
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <div className="relative aspect-[4/3] bg-[radial-gradient(ellipse_at_50%_35%,#fbf6ea_0%,#f2ead9_55%,#e8dcc3_100%)] sm:aspect-auto sm:min-h-[460px]">
          <ProductImage name={product.name} image={product.images[0]} oilTone={product.oilTone} size={variant?.label} sizes="(min-width: 640px) 450px, 100vw" bottleClassName="h-[82%] -translate-y-[5%]" />
        </div>
        <div className="flex flex-col p-6 sm:p-9">
          <p className="eyebrow">{product.categoryName}</p>
          <h2 className="mt-3 font-serif text-4xl leading-none">{product.name}</h2>
          <p className="mt-4 font-serif text-3xl tabular-nums">{variant ? formatINR(variant.price) : "—"}</p>
          <p className="mt-4 text-sm leading-relaxed text-muted">{product.shortDescription}</p>
          <p className="label mt-6">Bottle size</p>
          <SizeSelector variants={product.variants} value={variantId} onChange={setVariantId} name={product.name} size="lg" />
          <div className="mt-6 flex items-center gap-3">
            <QtyStepper value={qty} onChange={(q) => setQty(Math.max(1, q))} label={product.name} size="lg" />
            <button
              disabled={!product.available || !variant?.available}
              onClick={() => {
                if (!variant) return;
                addToCart(product, variant, qty);
                onClose();
              }}
              className="btn btn-primary flex-1"
            >
              Add to cart
            </button>
          </div>
          <Link href={`/oils/${product.slug}`} onClick={onClose} className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-brand uppercase hover:underline">
            Full details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
