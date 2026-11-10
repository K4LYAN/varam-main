import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductDetail } from "@/components/product/ProductDetail";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SectionHeading } from "@/components/home/SectionHeading";
import { JsonLd } from "@/components/site/JsonLd";
import { getProductBySlug, getProducts, relatedProducts } from "@/lib/data";
import { siteConfig } from "@/lib/config";

type Props = { params: Promise<{ slug: string }> };

const absolute = (src: string) => (src.startsWith("http") ? src : `${siteConfig.url}${src}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Oil not found" };
  const prices = product.variants.map((v) => v.price);
  const from = prices.length ? Math.min(...prices) : null;
  const description = `${product.shortDescription}${from !== null ? ` Available in ${product.variants.map((v) => v.label).join(", ")} from ₹${from}.` : ""}`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/oils/${product.slug}` },
    openGraph: {
      title: `${product.name} | VARAM`,
      description,
      url: `/oils/${product.slug}`,
      ...(product.images[0] ? { images: [{ url: absolute(product.images[0]) }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, all] = await Promise.all([getProductBySlug(slug), getProducts()]);
  if (!product) notFound();
  const related = relatedProducts(all, product);
  const url = `${siteConfig.url}/oils/${product.slug}`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description || product.shortDescription,
          brand: { "@type": "Brand", name: "VARAM" },
          category: product.categoryName,
          url,
          ...(product.images.length ? { image: product.images.map(absolute) } : {}),
          offers: product.variants.map((v) => ({
            "@type": "Offer",
            name: v.label,
            ...(v.sku ? { sku: v.sku } : {}),
            price: v.price.toFixed(2),
            priceCurrency: "INR",
            availability:
              product.available && v.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url,
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
            { "@type": "ListItem", position: 2, name: "Our Oils", item: `${siteConfig.url}/oils` },
            { "@type": "ListItem", position: 3, name: product.name, item: url },
          ],
        }}
      />

      <div className="container-luxe pt-6 pb-32 sm:pt-10 lg:pb-32">
        <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/oils" className="hover:text-ink">
            Our Oils
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/oils?category=${product.categorySlug}`} className="hover:text-ink">
            {product.categoryName}
          </Link>
        </nav>
        <ProductDetail product={product} pageUrl={url} />
      </div>

      {related.length > 0 && (
        <section className="border-t border-line bg-cream/50 py-24 sm:py-32">
          <div className="container-luxe">
            <SectionHeading
              eyebrow="You may also like"
              title={
                <>
                  More from the <span className="italic text-brand">press.</span>
                </>
              }
              link={{ href: "/oils", label: "All oils" }}
            />
            <ProductGrid products={related} list={{ id: "related_products", name: "Related Products" }} className="mt-14" />
          </div>
        </section>
      )}
    </>
  );
}
