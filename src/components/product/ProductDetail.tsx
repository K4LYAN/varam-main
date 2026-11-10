"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { clsx } from "clsx";
import type { Product } from "@/lib/types";
import { formatINR, lineTotal } from "@/lib/format";
import { analytics } from "@/lib/analytics";
import { buildProductEnquiryMessage } from "@/lib/whatsapp";
import { useWhatsApp } from "@/components/site/SiteProvider";
import { QtyStepper } from "@/components/site/CartDrawer";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { ProductImage } from "./ProductImage";
import { SizeSelector } from "./SizeSelector";
import { defaultVariant, useAddToCart } from "./useAddToCart";

const ease = [0.22, 1, 0.36, 1] as const;

export function ProductDetail({ product, pageUrl }: { product: Product; pageUrl: string }) {
  const initial = defaultVariant(product);
  const [variantId, setVariantId] = useState(initial?.id ?? "");
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const variant = product.variants.find((v) => v.id === variantId) ?? initial;
  const addToCart = useAddToCart();
  const { open: openWhatsApp } = useWhatsApp();
  const canBuy = product.available && Boolean(variant?.available);
  const images = product.images.length ? product.images : [null];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const enquire = (source: string) => {
    analytics.whatsappProductEnquiry(
      {
        item_id: product.id,
        item_name: product.name,
        item_brand: "VARAM",
        item_category: product.categoryName,
        item_variant: variant?.label,
        price: variant?.price,
        quantity: 1,
      },
      source,
    );
    openWhatsApp(buildProductEnquiryMessage(product.name, variant?.label, pageUrl));
  };

  const sections = [
    { title: "Description", body: product.description },
    { title: "How to use", body: product.uses },
    { title: "Ingredients", body: product.ingredients },
    { title: "Extraction process", body: product.extractionProcess },
    { title: "Storage", body: product.storage },
  ].filter((s) => s.body.trim());

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        {/* Gallery */}
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-28">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, ease }}
              className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-[radial-gradient(ellipse_at_50%_30%,#fdf9ef_0%,#f2ead9_55%,#e2d3b5_100%)] sm:aspect-[5/5] lg:aspect-[5/6]"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${imageIndex}-${images[imageIndex] ? "img" : variant?.label}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0"
                >
                  <ProductImage
                    name={product.name}
                    image={images[imageIndex]}
                    oilTone={product.oilTone}
                    size={variant?.label}
                    priority
                    sizes="(min-width: 1024px) 55vw, 100vw"
                    bottleClassName="h-[78%] -translate-y-[8%] drop-shadow-[0_40px_40px_rgba(59,42,23,0.22)]"
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>
            {images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto scrollbar-none">
                {images.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    onClick={() => setImageIndex(i)}
                    className={clsx(
                      "relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-cream ring-offset-2 ring-offset-ivory transition",
                      i === imageIndex ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100",
                    )}
                    aria-label={`Show image ${i + 1}`}
                  >
                    <ProductImage name={product.name} image={src} oilTone={product.oilTone} sizes="80px" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Purchase panel */}
        <div className="lg:col-span-5">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease, delay: 0.15 }}>
            <p className="eyebrow">{product.categoryName}</p>
            <h1 className="display mt-4 text-5xl sm:text-6xl">{product.name}</h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">{product.shortDescription}</p>

            <div className="mt-8 flex items-baseline gap-3 border-t border-line pt-8">
              <AnimatePresence mode="wait">
                <motion.p
                  key={variant?.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="font-serif text-5xl tabular-nums"
                  aria-live="polite"
                >
                  {variant ? formatINR(variant.price) : "—"}
                </motion.p>
              </AnimatePresence>
              {variant && <span className="text-sm text-muted">/ {variant.label}</span>}
            </div>
            <p className="mt-1 text-xs text-muted">Delivery charges are confirmed with you on WhatsApp</p>

            <div className="mt-8">
              <p className="label">Bottle size</p>
              <SizeSelector variants={product.variants} value={variantId} onChange={setVariantId} name={product.name} size="lg" />
            </div>

            <div className="mt-8">
              <p className="label">Quantity</p>
              <div className="flex flex-wrap items-center gap-3">
                <QtyStepper value={qty} onChange={(q) => setQty(Math.max(1, q))} label={product.name} size="lg" />
                {variant && qty > 1 && (
                  <span className="text-sm text-muted">
                    Subtotal <strong className="text-ink tabular-nums">{formatINR(lineTotal(variant.price, qty))}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => variant && addToCart(product, variant, qty)}
                disabled={!canBuy}
                className="btn btn-primary min-h-14 flex-1"
              >
                {canBuy ? "Add to cart" : "Currently unavailable"}
              </button>
              <button onClick={() => enquire("product_page")} className="btn btn-outline min-h-14 flex-1 text-[#1f7a4d]">
                <WhatsAppIcon className="h-5 w-5" /> Enquire on WhatsApp
              </button>
            </div>

            <ul className="mt-6 grid gap-2.5 rounded-2xl bg-cream/70 p-5 text-[13px] text-ink/80 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand" /> {/ghee/i.test(product.name) ? "Prepared the traditional way" : "Traditionally cold-pressed"}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand" /> Add to cart — nothing is charged online
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand" /> Order confirmed personally on WhatsApp
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand" /> Delivery charges shared before payment
              </li>
            </ul>

            <div className="mt-12 divide-y divide-line border-y border-line">
              {sections.map((s, i) => (
                <Accordion key={s.title} title={s.title} defaultOpen={i === 0}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink/75">{s.body}</p>
                </Accordion>
              ))}
              {product.specifications.length > 0 && (
                <Accordion title="Specifications">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2.5 text-sm">
                    {product.specifications.map((s) => (
                      <div key={s.label} className="contents">
                        <dt className="text-muted">{s.label}</dt>
                        <dd className="text-ink/85">{s.value}</dd>
                      </div>
                    ))}
                    <dt className="text-muted">Available sizes</dt>
                    <dd className="text-ink/85">{product.variants.map((v) => v.label).join(", ")}</dd>
                  </dl>
                </Accordion>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mobile sticky purchase bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{variant?.label}</p>
            <p className="font-serif text-2xl leading-none tabular-nums">{variant ? formatINR(lineTotal(variant.price, qty)) : "—"}</p>
          </div>
          <button onClick={() => enquire("product_sticky_bar")} className="grid h-12 w-12 place-items-center rounded-full border border-line text-[#1f7a4d]" aria-label="Enquire on WhatsApp">
            <WhatsAppIcon className="h-5 w-5" />
          </button>
          <button onClick={() => variant && addToCart(product, variant, qty)} disabled={!canBuy} className="btn btn-primary min-h-12 px-6">
            Add to cart
          </button>
        </div>
      </div>
    </>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between py-5 text-left" aria-expanded={open}>
        <span className="font-serif text-2xl">{title}</span>
        {open ? <Minus className="h-4 w-4 text-muted" /> : <Plus className="h-4 w-4 text-muted" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease }} className="overflow-hidden">
            <div className="pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
