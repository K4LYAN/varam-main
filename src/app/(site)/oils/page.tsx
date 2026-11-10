import type { Metadata } from "next";
import { Suspense } from "react";
import { MapPin, MessageCircle, Tag } from "lucide-react";
import { ShopCatalog } from "@/components/product/ShopCatalog";
import { Reveal } from "@/components/ui/Reveal";
import { getCategories, getProducts } from "@/lib/data";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shop Cold-Pressed Oils & Ghee",
  description:
    "Shop VARAM cold-pressed groundnut, sesame, coconut, mustard, sunflower and castor oils, and pure ghee. Add to cart and order easily on WhatsApp, or visit our store in Vijayawada.",
  alternates: { canonical: "/oils" },
};

export default async function OilsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const prices = products.flatMap((p) => p.variants.map((v) => v.price));
  const from = prices.length ? Math.min(...prices) : null;

  return (
    <>
      <section className="pt-10 pb-10 sm:pt-16 sm:pb-12">
        <div className="container-luxe grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <p className="eyebrow">Shop</p>
            <h1 className="display mt-4 text-[3.1rem] sm:text-7xl lg:text-8xl">
              The VARAM <span className="italic text-brand">collection.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              Traditionally extracted cold-pressed oils and pure ghee. Add your favourites to the cart and send your order on
              WhatsApp — we confirm everything with you personally.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <ul className="grid grid-cols-3 gap-2 text-center sm:gap-3">
              <li className="rounded-2xl border border-line bg-white/70 px-2 py-4">
                <Tag className="mx-auto h-4 w-4 text-accent" />
                <p className="mt-2 font-serif text-2xl leading-none sm:text-3xl">{products.length}</p>
                <p className="mt-1 text-[11px] text-muted">products</p>
              </li>
              <li className="rounded-2xl border border-line bg-white/70 px-2 py-4">
                <MessageCircle className="mx-auto h-4 w-4 text-accent" />
                <p className="mt-2 font-serif text-2xl leading-none sm:text-3xl">{from !== null ? formatINR(from) : "—"}</p>
                <p className="mt-1 text-[11px] text-muted">starting price</p>
              </li>
              <li className="rounded-2xl border border-line bg-white/70 px-2 py-4">
                <MapPin className="mx-auto h-4 w-4 text-accent" />
                <p className="mt-2 font-serif text-xl leading-none sm:text-2xl">Vijayawada</p>
                <p className="mt-1 text-[11px] text-muted">visit our store</p>
              </li>
            </ul>
          </Reveal>
        </div>
      </section>
      <div className="container-luxe pb-24 sm:pb-32">
        <Suspense>
          <ShopCatalog products={products} categories={categories} />
        </Suspense>
      </div>
    </>
  );
}
