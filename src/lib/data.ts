import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "./db";
import { mergeSettings } from "./defaults";
import { envWhatsAppNumber } from "./config";
import type { Category, Product, PublicSettings, SiteSettings, Testimonial } from "./types";

export const TAGS = {
  catalog: "catalog",
  settings: "settings",
  testimonials: "testimonials",
} as const;

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  short_description: string;
  description: string;
  ingredients: string;
  extraction_process: string;
  storage: string;
  uses: string | null;
  specifications: unknown;
  images: unknown;
  variants: unknown;
  oil_tone: string;
  featured: boolean;
  is_new: boolean;
  available: boolean;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const json = <T>(v: unknown, fallback: T): T => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return (v as T) ?? fallback;
};

function mapProduct(r: ProductRow): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    categoryId: r.category_id,
    categoryName: r.category_name ?? "Uncategorised",
    categorySlug: r.category_slug ?? "uncategorised",
    shortDescription: r.short_description,
    description: r.description,
    ingredients: r.ingredients,
    extractionProcess: r.extraction_process,
    storage: r.storage,
    uses: r.uses ?? "",
    specifications: json(r.specifications, []),
    images: json(r.images, []),
    variants: json(r.variants, []),
    oilTone: r.oil_tone,
    featured: r.featured,
    isNew: r.is_new,
    available: r.available,
    sortOrder: r.sort_order,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

const PRODUCT_SELECT = `
  select p.*, c.name as category_name, c.slug as category_slug
  from products p left join categories c on c.id = p.category_id`;

/** Uncached reads — used by the admin dashboard so edits show immediately. */
export const db = {
  async allProducts(): Promise<Product[]> {
    const rows = await query<ProductRow>(`${PRODUCT_SELECT} order by p.sort_order asc, p.created_at asc`);
    return rows.map(mapProduct);
  },
  async productById(id: string): Promise<Product | null> {
    const rows = await query<ProductRow>(`${PRODUCT_SELECT} where p.id = $1`, [id]);
    return rows[0] ? mapProduct(rows[0]) : null;
  },
  async categories(): Promise<Category[]> {
    const rows = await query<{ id: string; slug: string; name: string; description: string; sort_order: number }>(
      "select * from categories order by sort_order asc, name asc",
    );
    return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, description: r.description, sortOrder: r.sort_order }));
  },
  async testimonials(): Promise<Testimonial[]> {
    const rows = await query<{
      id: string;
      name: string;
      location: string;
      quote: string;
      published: boolean;
      sort_order: number;
      rating: number | null;
      source: string | null;
      review_date: string | null;
    }>("select * from testimonials order by sort_order asc, created_at desc");
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location,
      quote: r.quote,
      published: r.published,
      sortOrder: r.sort_order,
      rating: Math.max(1, Math.min(5, Number(r.rating ?? 5))),
      source: r.source === "google" ? "google" : "customer",
      date: r.review_date ?? "",
    }));
  },
  async settings(): Promise<SiteSettings> {
    const rows = await query<{ value: unknown }>("select value from settings where key = 'site'");
    return mergeSettings(json(rows[0]?.value, {}));
  },
};

/* ---------- Cached storefront reads (invalidated by admin mutations) ---------- */

/** Production: cached for up to an hour and invalidated instantly by admin saves.
 *  Development: always reads the database, so manual DB changes show immediately. */
function cached<T>(fn: () => Promise<T>, key: string, tag: string): () => Promise<T> {
  if (process.env.NODE_ENV !== "production") return fn;
  return unstable_cache(fn, [key], { tags: [tag], revalidate: 3600 });
}

const cachedProducts = cached(() => db.allProducts(), "products-all", TAGS.catalog);
const cachedCategories = cached(() => db.categories(), "categories-all", TAGS.catalog);
const cachedSettings = cached(() => db.settings(), "settings-site", TAGS.settings);
const cachedTestimonials = cached(() => db.testimonials(), "testimonials-all", TAGS.testimonials);

/** Products visible on the storefront (unavailable products are still listed, marked "out of stock"). */
export async function getProducts(): Promise<Product[]> {
  return cachedProducts();
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await cachedProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getCategories(): Promise<Category[]> {
  const [cats, products] = await Promise.all([cachedCategories(), cachedProducts()]);
  // Only show categories that contain products
  return cats.filter((c) => products.some((p) => p.categoryId === c.id));
}

export async function getSettings(): Promise<SiteSettings> {
  return cachedSettings();
}

export async function getPublishedTestimonials(): Promise<Testimonial[]> {
  const all = await cachedTestimonials();
  return all.filter((t) => t.published);
}

export function toPublicSettings(s: SiteSettings): PublicSettings {
  return {
    whatsappNumber: s.contact.whatsappNumber || envWhatsAppNumber,
    contact: s.contact,
    social: s.social,
    brand: s.brand,
  };
}

export function relatedProducts(all: Product[], product: Product, limit = 4): Product[] {
  const same = all.filter((p) => p.id !== product.id && p.categoryId === product.categoryId);
  const others = all.filter((p) => p.id !== product.id && p.categoryId !== product.categoryId);
  return [...same, ...others.filter((p) => p.featured), ...others.filter((p) => !p.featured)].slice(0, limit);
}
