"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Copy, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { cartTotals, MAX_QTY, toGaItem, useCart, type CartItem } from "@/store/cart";
import { formatINR, lineTotal } from "@/lib/format";
import { buildOrderMessage } from "@/lib/whatsapp";
import { analytics } from "@/lib/analytics";
import { ProductImage } from "@/components/product/ProductImage";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { toast } from "@/store/toast";
import { useWhatsApp } from "./SiteProvider";

const ease = [0.22, 1, 0.36, 1] as const;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CartDrawer() {
  const { items, isOpen, close, setQuantity, remove, clear } = useCart();
  const [stage, setStage] = useState<"cart" | "sent">("cart");
  const [showPreview, setShowPreview] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { open: openWhatsApp, configured } = useWhatsApp();

  const orderable = useMemo(() => items.filter((i) => !i.unavailable), [items]);
  const hasUnavailable = orderable.length !== items.length;
  const { count, subtotal } = cartTotals(items);
  const message = useMemo(
    () =>
      buildOrderMessage(
        orderable.map((i) => ({ name: i.name, size: i.size, quantity: i.quantity, unitPrice: i.unitPrice })),
      ),
    [orderable],
  );

  // Reset to the cart view each time the drawer opens
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setStage("cart");
      setShowPreview(false);
    }
  }

  // view_cart once per opening
  useEffect(() => {
    if (!isOpen) return;
    const current = useCart.getState().items.filter((i) => !i.unavailable);
    analytics.viewCart(current.map(toGaItem));
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  const handleRemove = (item: CartItem) => {
    analytics.removeFromCart(toGaItem(item));
    remove(item.key);
  };

  const handleQty = (item: CartItem, next: number) => {
    if (next < 1) return handleRemove(item);
    const delta = next - item.quantity;
    if (delta > 0) analytics.addToCart(toGaItem({ ...item, quantity: delta }));
    if (delta < 0) analytics.removeFromCart(toGaItem({ ...item, quantity: -delta }));
    setQuantity(item.key, next);
  };

  const handleOrder = () => {
    if (!orderable.length || hasUnavailable) return;
    analytics.whatsappOrderClick(orderable.map(toGaItem), "cart_drawer");
    openWhatsApp(message);
    setStage("sent");
    toast({ title: "Opening WhatsApp…", description: "Review the message and tap send to share your order with VARAM." });
  };

  const handleCopy = async () => {
    const ok = await copyText(message);
    toast(
      ok
        ? { title: "Order message copied", description: "Paste it into a WhatsApp chat with VARAM." }
        : { title: "Couldn't copy automatically", description: "Use 'Preview message' and copy it manually.", tone: "warning" },
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Shopping cart">
          <motion.button
            aria-label="Close cart"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={close}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.6, ease }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-ivory shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-5 sm:px-7">
              <div>
                <p className="eyebrow">Your selection</p>
                <h2 className="mt-1 font-serif text-3xl">
                  Cart{" "}
                  {count > 0 && <span className="text-xl text-muted">({count} item{count === 1 ? "" : "s"})</span>}
                </h2>
              </div>
              <button ref={closeRef} onClick={close} className="grid h-11 w-11 place-items-center rounded-full hover:bg-cream" aria-label="Close cart">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            {stage === "sent" ? (
              <SentPanel
                onCopy={handleCopy}
                onRetry={() => openWhatsApp(message)}
                onBack={() => setStage("cart")}
                onClear={() => {
                  clear();
                  close();
                  toast({ title: "Cart cleared", description: "Thank you for ordering with VARAM." });
                }}
              />
            ) : items.length === 0 ? (
              <EmptyCart onClose={close} />
            ) : (
              <>
                <ul className="flex-1 divide-y divide-line overflow-y-auto px-5 sm:px-7">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item.key}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                        transition={{ duration: 0.4, ease }}
                        className="flex gap-4 py-5"
                      >
                        <Link
                          href={`/oils/${item.slug}`}
                          onClick={close}
                          className="relative h-28 w-22 shrink-0 overflow-hidden rounded-lg bg-cream"
                        >
                          <ProductImage name={item.name} image={item.image} oilTone={item.oilTone} sizes="88px" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link href={`/oils/${item.slug}`} onClick={close} className="font-serif text-xl leading-tight hover:text-brand">
                                {item.name}
                              </Link>
                              <p className="mt-1 text-xs tracking-wide text-muted">
                                {item.size} · {formatINR(item.unitPrice)} each
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemove(item)}
                              className="-mt-1 -mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-cream hover:text-copper"
                              aria-label={`Remove ${item.name} ${item.size}`}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                          </div>
                          {item.unavailable && (
                            <p className="mt-2 rounded-md bg-copper/10 px-2 py-1 text-xs text-copper">
                              Currently unavailable — please remove to continue.
                            </p>
                          )}
                          <div className="mt-auto flex items-end justify-between pt-3">
                            <QtyStepper
                              value={item.quantity}
                              onChange={(q) => handleQty(item, q)}
                              label={`${item.name} ${item.size}`}
                            />
                            <p className="text-sm font-semibold tabular-nums">
                              {formatINR(lineTotal(item.unitPrice, item.quantity))}
                            </p>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <div className="border-t border-line bg-cream/60 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">Total items</dt>
                      <dd className="tabular-nums">{count}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Subtotal</dt>
                      <dd className="tabular-nums">{formatINR(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Delivery charges</dt>
                      <dd className="text-muted">To be confirmed</dd>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-line pt-3">
                      <dt className="font-serif text-xl">Total product value</dt>
                      <dd className="font-serif text-2xl tabular-nums">{formatINR(subtotal)}</dd>
                    </div>
                  </dl>

                  <button
                    onClick={handleOrder}
                    disabled={!orderable.length || hasUnavailable}
                    className="btn btn-whatsapp mt-5 w-full"
                  >
                    <WhatsAppIcon className="h-5 w-5" /> Order via WhatsApp
                  </button>
                  <p className="mt-3 text-center text-[11.5px] leading-relaxed text-muted">
                    This sends an order enquiry. We&apos;ll confirm availability, delivery charges and payment with you on
                    WhatsApp.
                    {!configured && process.env.NODE_ENV !== "production" && (
                      <span className="mt-1 block text-copper">
                        Dev note: no WhatsApp business number is configured yet — set it in Admin → Content.
                      </span>
                    )}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button onClick={close} className="text-xs font-semibold tracking-[0.16em] text-brand uppercase hover:underline">
                      Continue shopping
                    </button>
                    <button
                      onClick={() => setShowPreview((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                      aria-expanded={showPreview}
                    >
                      Preview message <ChevronDown className={clsx("h-3.5 w-3.5 transition", showPreview && "rotate-180")} />
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {showPreview && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-line bg-ivory p-3 font-sans text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink/80">
                          {message}
                        </pre>
                        <button onClick={handleCopy} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
                          <Copy className="h-3.5 w-3.5" /> Copy order message
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function QtyStepper({
  value,
  onChange,
  label,
  size = "sm",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  size?: "sm" | "lg";
}) {
  const h = size === "lg" ? "h-12" : "h-9";
  const w = size === "lg" ? "w-12" : "w-9";
  return (
    <div className={clsx("inline-flex items-center rounded-full border border-line bg-ivory", h)} role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className={clsx("grid place-items-center rounded-full text-ink/70 hover:text-ink disabled:opacity-30", h, w)}
        aria-label="Decrease quantity"
        disabled={size === "lg" && value <= 1}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QTY}
        className={clsx("grid place-items-center rounded-full text-ink/70 hover:text-ink disabled:opacity-30", h, w)}
        aria-label="Increase quantity"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-cream">
        <ShoppingBag className="h-8 w-8 text-brand" strokeWidth={1.2} />
      </div>
      <h3 className="mt-6 font-serif text-3xl">Your cart is empty</h3>
      <p className="mt-2 max-w-xs text-sm text-muted">Explore our cold-pressed oils and add your favourites.</p>
      <Link href="/oils" onClick={onClose} className="btn btn-primary mt-8">
        Explore our oils <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function SentPanel({
  onCopy,
  onRetry,
  onBack,
  onClear,
}: {
  onCopy: () => void;
  onRetry: () => void;
  onBack: () => void;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
      className="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <div className="grid h-20 w-20 place-items-center rounded-full bg-[#1f7a4d] text-white">
        <Check className="h-9 w-9" strokeWidth={1.6} />
      </div>
      <h3 className="mt-6 font-serif text-3xl leading-tight">WhatsApp is opening with your order</h3>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
        Review the pre-filled message and tap <strong className="text-ink">send</strong>. Our team will confirm availability,
        delivery charges and payment with you. Your order is not confirmed until we reply.
      </p>
      <div className="mt-8 w-full max-w-xs space-y-3">
        <button onClick={onRetry} className="btn btn-whatsapp w-full">
          <WhatsAppIcon className="h-5 w-5" /> Open WhatsApp again
        </button>
        <button onClick={onCopy} className="btn btn-outline w-full">
          <Copy className="h-4 w-4" /> Copy order message
        </button>
      </div>
      <p className="mt-8 text-xs text-muted">Your cart is saved on this device.</p>
      <div className="mt-3 flex gap-6 text-xs font-semibold tracking-[0.14em] uppercase">
        <button onClick={onBack} className="text-brand hover:underline">
          Back to cart
        </button>
        <button onClick={onClear} className="text-copper hover:underline">
          I&apos;ve sent it — clear cart
        </button>
      </div>
    </motion.div>
  );
}
