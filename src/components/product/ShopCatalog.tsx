"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, MapPin, Search, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import type { Category, Product } from "@/lib/types";
import { analytics } from "@/lib/analytics";
import { GENERAL_ENQUIRY_MESSAGE } from "@/lib/whatsapp";
import { useWhatsApp } from "@/components/site/SiteProvider";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { ProductCard } from "./ProductCard";
import { QuickView } from "./QuickView";
import { toListItems } from "./ProductGrid";
import { BottleArt } from "./BottleArt";

type Sort = "featured" | "newest" | "price-asc" | "price-desc" | "name";
type Flag = "all" | "new" | "featured";

const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name: A–Z" },
];
const FLAGS: { value: Flag; label: string }[] = [
  { value: "all", label: "All products" },
  { value: "featured", label: "Bestsellers" },
  { value: "new", label: "New arrivals" },
];

const minPrice = (p: Product) => Math.min(...p.variants.map((v) => v.price), Number.POSITIVE_INFINITY);

/** Opens the VARAM assistant (listened for in Assistant.tsx). */
export const openAssistant = () => window.dispatchEvent(new Event("varam:open-assistant"));

export function ShopCatalog({ products, categories }: { products: Product[]; categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { open: openWhatsApp } = useWhatsApp();

  const [q, setQ] = useState(params.get("q") ?? "");
  const category = params.get("category") ?? "all";
  const sort = (SORTS.some((s) => s.value === params.get("sort")) ? params.get("sort") : "featured") as Sort;
  const flag = (FLAGS.some((f) => f.value === params.get("show")) ? params.get("show") : "all") as Flag;
  const [quick, setQuick] = useState<Product | null>(null);

  const setParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === defaultValue || !value) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clearAll = () => {
    setQ("");
    router.replace(pathname, { scroll: false });
  };

  // Debounce search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) setParam("q", q.trim(), "");
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category !== "all" && p.categorySlug !== category) return false;
      if (flag === "new" && !p.isNew) return false;
      if (flag === "featured" && !p.featured) return false;
      if (!term) return true;
      return [p.name, p.shortDescription, p.categoryName, p.ingredients, p.uses].some((s) => s.toLowerCase().includes(term));
    });
    list = [...list];
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => minPrice(a) - minPrice(b));
        break;
      case "price-desc":
        list.sort((a, b) => minPrice(b) - minPrice(a));
        break;
      case "newest":
        list.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.createdAt.localeCompare(a.createdAt));
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder);
    }
    return list;
  }, [products, q, category, flag, sort]);

  const activeCategory = categories.find((c) => c.slug === category);
  const list = { id: activeCategory ? `category_${activeCategory.slug}` : "all_oils", name: activeCategory?.name ?? "All Oils" };
  const listKey = `${list.id}|${flag}|${sort}|${filtered.map((p) => p.id).join(",")}`;

  useEffect(() => {
    if (!filtered.length) return;
    const t = setTimeout(() => analytics.viewItemList(list.id, list.name, toListItems(filtered, list)), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const tiles = [
    { slug: "all", name: "All products", items: products },
    ...categories.map((c) => ({ slug: c.slug, name: c.name, items: products.filter((p) => p.categoryId === c.id) })),
  ];

  const chips = [
    activeCategory && { key: "category", label: activeCategory.name, clear: () => setParam("category", "all", "all") },
    flag !== "all" && { key: "show", label: FLAGS.find((f) => f.value === flag)!.label, clear: () => setParam("show", "all", "all") },
    q.trim() && { key: "q", label: `“${q.trim()}”`, clear: () => setQ("") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div>
      {/* Category tiles */}
      <div
        className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0"
        role="tablist"
        aria-label="Shop by category"
      >
        {tiles.map((t) => {
          const active = category === t.slug;
          const shown = t.items.slice(0, t.slug === "all" ? 3 : 2);
          const mid = Math.floor(shown.length / 2);
          return (
            <button
              key={t.slug}
              role="tab"
              aria-selected={active}
              onClick={() => setParam("category", t.slug, "all")}
              className={clsx(
                "group relative flex h-[11.5rem] w-[8.75rem] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl border p-3.5 text-left transition duration-500 lg:w-auto",
                active
                  ? "border-brand bg-brand text-ivory shadow-[0_18px_40px_-20px_rgba(61,31,14,0.6)]"
                  : "border-line bg-white/70 hover:-translate-y-0.5 hover:border-sand",
              )}
            >
              <span className="pointer-events-none absolute inset-x-0 top-3 flex h-[5.5rem] items-end justify-center" aria-hidden="true">
                {shown.map((p, i) => (
                  <span
                    key={p.id}
                    className="relative -mx-1.5 transition-transform duration-500 group-hover:-translate-y-1"
                    style={{ transitionDelay: `${i * 60}ms`, zIndex: i === mid ? 2 : 1 }}
                  >
                    <BottleArt name={p.name} tone={p.oilTone} className={clsx("w-auto", i === mid ? "h-[5.5rem]" : "h-[4.6rem]")} />
                  </span>
                ))}
              </span>
              <span className="relative line-clamp-2 font-serif text-[1.08rem] leading-[1.1]">{t.name}</span>
              <span className={clsx("relative mt-0.5 text-[11px]", active ? "text-ivory/70" : "text-muted")}>
                {t.items.length} product{t.items.length === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="mt-8 rounded-2xl border border-line bg-white/70 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-full sm:basis-auto">
            <span className="sr-only">Search oils</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search oils, ghee or uses — e.g. pickles"
              className="h-11 w-full rounded-full border border-line bg-white pr-10 pl-10 text-sm outline-none focus:border-accent"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-cream hover:text-ink" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <Select label="Show" value={flag} options={FLAGS} onChange={(v) => setParam("show", v, "all")} />
          <Select label="Sort by" value={sort} options={SORTS} onChange={(v) => setParam("sort", v, "featured")} prefix="Sort: " />
        </div>
        <div className="mt-2.5 flex min-h-7 flex-wrap items-center gap-2">
          <p className="mr-1 text-xs text-muted" aria-live="polite">
            <strong className="font-semibold text-ink">{filtered.length}</strong> {filtered.length === 1 ? "product" : "products"}
          </p>
          {chips.map((c) => (
            <button key={c.key} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs text-ink hover:bg-cream-deep" aria-label={`Remove filter ${c.label}`}>
              {c.label} <X className="h-3 w-3" />
            </button>
          ))}
          {(chips.length > 0 || sort !== "featured") && (
            <button onClick={clearAll} className="text-xs font-semibold text-brand underline-offset-2 hover:underline">
              Reset all
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="pt-8">
        <AnimatePresence mode="wait">
          {filtered.length ? (
            <motion.div
              key={`${category}-${flag}-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="shop-grid"
            >
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} list={list} onQuickView={setQuick} priority={i < 4} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[1.75rem] border border-dashed border-line py-20 text-center">
              <p className="font-serif text-3xl">No products match your search.</p>
              <p className="mt-2 text-sm text-muted">Try another word, or ask us — we&apos;re happy to help.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button onClick={clearAll} className="btn btn-outline">
                  Clear filters
                </button>
                <button onClick={openAssistant} className="btn btn-primary">
                  <Sparkles className="h-4 w-4" /> Ask the assistant
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Help banner */}
      <div className="mt-16 grid overflow-hidden rounded-[1.75rem] bg-brand-900 text-ivory sm:mt-20 lg:grid-cols-[1.2fr_1fr]">
        <div className="p-7 sm:p-10">
          <p className="eyebrow text-accent-300">Need a hand?</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Not sure which oil to choose?</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ivory/70">
            Tell our assistant how you cook and it will suggest the right oils — or chat with our team, or drop by the store in Vijayawada.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={openAssistant} className="btn btn-accent">
              <Sparkles className="h-4 w-4" /> Ask the assistant
            </button>
            <button
              onClick={() => {
                analytics.whatsappContactClick("shop_help_banner");
                openWhatsApp(GENERAL_ENQUIRY_MESSAGE);
              }}
              className="btn btn-whatsapp"
            >
              <WhatsAppIcon className="h-4 w-4" /> WhatsApp
            </button>
            <Link href="/stores" className="btn btn-ghost-light">
              <MapPin className="h-4 w-4" /> Visit store
            </Link>
          </div>
        </div>
        <div className="relative hidden min-h-56 items-end justify-center gap-1 bg-[radial-gradient(ellipse_at_50%_80%,rgba(244,205,122,0.25),transparent_65%)] px-8 pt-8 lg:flex" aria-hidden="true">
          {products.slice(0, 5).map((p, i) => (
            <BottleArt key={p.id} name={p.name} tone={p.oilTone} className={clsx("w-auto", i === 2 ? "h-56" : i % 2 ? "h-48" : "h-40")} />
          ))}
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  prefix = "",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  prefix?: string;
}) {
  return (
    <label className="relative flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 w-full appearance-none rounded-full border border-line bg-white pr-9 pl-4 text-[13px] font-medium outline-none focus:border-accent sm:w-auto"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {prefix}
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
    </label>
  );
}
