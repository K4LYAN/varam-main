"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, ShoppingBag, X } from "lucide-react";
import { clsx } from "clsx";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { BottleArt } from "@/components/product/BottleArt";
import { useCart } from "@/store/cart";
import { useIsland } from "@/store/island";
import { useHydrated } from "@/lib/useHydrated";
import { analytics } from "@/lib/analytics";
import { GENERAL_ENQUIRY_MESSAGE } from "@/lib/whatsapp";
import { useWhatsApp } from "./SiteProvider";

/** Pages whose first section is a full-bleed image (the island floats over it). */
const HERO_PAGES = ["/", "/our-story", "/our-process"];

export const NAV = [
  { href: "/oils", label: "Shop" },
  { href: "/our-story", label: "Story" },
  { href: "/our-process", label: "Process" },
  { href: "/stores", label: "Stores" },
  { href: "/contact", label: "Contact" },
];

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;

/**
 * Dynamic Island navigation — a floating pill that morphs between states:
 *  - full     (desktop, top of page / scrolling up / hover): logo · links · WhatsApp · cart
 *  - compact  (desktop, scrolling down): mark · current section · cart
 *  - phones:  logo · cart · menu
 *  - notice   "Added to cart" live activity, then back
 *  - menu     (phones) expands into the full navigation
 */
export function Header() {
  const pathname = usePathname();
  const overHero = HERO_PAGES.includes(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hover, setHover] = useState(false);
  const lastY = useRef(0);
  const hydrated = useHydrated();
  const count = useCart((s) => s.items.reduce((n, i) => n + (i.unavailable ? 0 : i.quantity), 0));
  const openCart = useCart((s) => s.open);
  const notice = useIsland((s) => s.notice);
  const clearNotice = useIsland((s) => s.clear);
  const { open: openWhatsApp } = useWhatsApp();

  // Close the menu after navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 160) setCompact(false);
      else if (delta > 6) setCompact(true);
      else if (delta < -6) setCompact(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const isActive = (href: string) => pathname.startsWith(href);
  const current = NAV.find((n) => isActive(n.href))?.label ?? "Home";
  const mode = menuOpen ? "menu" : notice ? "notice" : compact && !hover ? "compact" : "full";

  const whatsapp = (source: string) => {
    analytics.whatsappContactClick(source);
    openWhatsApp(GENERAL_ENQUIRY_MESSAGE);
  };

  const cartButton = (solid: boolean) => (
    <button
      onClick={openCart}
      className={clsx(
        "relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition",
        solid ? "bg-ivory text-brand-950 hover:bg-accent-300" : "hover:bg-ivory/10",
      )}
      aria-label={`Open cart${hydrated ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
    >
      <ShoppingBag className="h-[19px] w-[19px]" strokeWidth={1.6} />
      <AnimatePresence>
        {hydrated && count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 22 }}
            className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-brand-950"
          >
            {count > 99 ? "99+" : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );

  const logoBadge = (
    <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ivory ring-1 ring-accent/60">
      <Image src="/brand/varam-logo.jpg" alt="" fill sizes="36px" priority className="scale-[1.12] object-cover" />
    </span>
  );

  const logo = (
    <Link href="/" aria-label="VARAM Organic Oil — home" className="flex shrink-0 items-center gap-2.5 rounded-full py-0.5 pr-2 pl-0.5">
      {logoBadge}
      <span className="font-serif text-[1.3rem] leading-none tracking-[0.28em]">VARAM</span>
    </Link>
  );

  const mobileBar = (
    <div className="flex items-center gap-1 p-1.5 lg:hidden">
      {logo}
      <span className="w-3" />
      {cartButton(false)}
      <button
        onClick={() => setMenuOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-full bg-ivory text-brand-950"
        aria-label="Open menu"
        aria-expanded={false}
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>
    </div>
  );

  let content: React.ReactNode;
  if (mode === "menu") {
    content = (
      <div className="w-[min(calc(100vw-1.5rem),26rem)] p-2">
        <div className="flex items-center justify-between pr-1">
          {logo}
          <button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ivory/10" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Mobile" className="mt-2 px-2 pb-2">
          {[{ href: "/", label: "Home" }, ...NAV].map((item, i) => {
            const active = item.href === "/" ? pathname === "/" : isActive(item.href);
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex items-center justify-between border-b border-ivory/10 py-3.5 font-serif text-[1.9rem] leading-none",
                    active && "text-accent-300",
                  )}
                >
                  {item.label}
                  <ArrowRight className="h-4 w-4 opacity-40" />
                </Link>
              </motion.div>
            );
          })}
          <button onClick={() => whatsapp("island_menu")} className="btn btn-whatsapp mt-5 w-full">
            <WhatsAppIcon className="h-5 w-5" /> Chat on WhatsApp
          </button>
        </nav>
      </div>
    );
  } else if (mode === "notice" && notice) {
    content = (
      <div className="flex w-[min(calc(100vw-1.5rem),24rem)] items-center gap-3 p-2 pr-2.5" role="status">
        <span className="flex h-11 w-11 shrink-0 items-end justify-center overflow-hidden rounded-full bg-cream">
          <BottleArt name={notice.name} tone={notice.oilTone} className="h-10 w-auto translate-y-1" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">{notice.title}</span>
          <span className="block truncate text-xs text-ivory/65">{notice.subtitle}</span>
        </span>
        <button
          onClick={() => {
            clearNotice();
            openCart();
          }}
          className="h-9 shrink-0 rounded-full bg-accent px-4 text-[11px] font-bold tracking-[0.12em] text-brand-950 uppercase hover:bg-accent-300"
        >
          View cart
        </button>
      </div>
    );
  } else if (mode === "compact") {
    content = (
      <>
        <div className="hidden items-center gap-3 p-1.5 lg:flex">
          <Link href="/" aria-label="VARAM Organic Oil — home" className="grid h-10 w-10 place-items-center">
            {logoBadge}
          </Link>
          <span className="min-w-20 text-center text-[11px] font-semibold tracking-[0.22em] text-ivory/80 uppercase">{current}</span>
          {cartButton(true)}
        </div>
        {mobileBar}
      </>
    );
  } else {
    content = (
      <>
        <div className="hidden items-center gap-1 p-1.5 lg:flex">
          {logo}
          <span className="mx-2 h-5 w-px bg-ivory/15" />
          <nav aria-label="Main" className="flex items-center">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={clsx(
                  "relative isolate rounded-full px-4 py-2.5 text-[12px] font-semibold tracking-[0.14em] uppercase transition-colors",
                  isActive(item.href) ? "text-brand-950" : "text-ivory/75 hover:text-ivory",
                )}
              >
                {isActive(item.href) && (
                  <motion.span layoutId="island-active" className="absolute inset-0 -z-10 rounded-full bg-accent-300" transition={spring} />
                )}
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="mx-2 h-5 w-px bg-ivory/15" />
          <button onClick={() => whatsapp("island")} className="grid h-10 w-10 place-items-center rounded-full text-[#5fd08f] hover:bg-ivory/10" aria-label="Chat on WhatsApp">
            <WhatsAppIcon className="h-[19px] w-[19px]" />
          </button>
          {cartButton(true)}
        </div>
        {mobileBar}
      </>
    );
  }

  return (
    <>
      <AnimatePresence>
        {menuOpen && (
          <motion.button
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <header className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-4">
        <motion.div
          layout
          transition={spring}
          style={{ borderRadius: 28 }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="pointer-events-auto overflow-hidden bg-brand-950/[0.88] text-ivory shadow-[0_18px_50px_-18px_rgba(28,14,5,0.65)] ring-1 ring-ivory/10 backdrop-blur-xl"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, scale: 0.94, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.94, filter: "blur(6px)" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </header>

      {/* Reserve space under the floating island on pages without a full-bleed hero */}
      {!overHero && <div aria-hidden="true" className="h-[84px] sm:h-[96px]" />}
    </>
  );
}
