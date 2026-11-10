import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/data";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const products = await getProducts();
  const now = new Date();
  const pages = ["", "/oils", "/our-story", "/our-process", "/stores", "/contact"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.8,
  }));
  const policies = ["privacy", "terms", "shipping", "returns"].map((p) => ({
    url: `${base}/policies/${p}`,
    changeFrequency: "yearly" as const,
    priority: 0.2,
  }));
  const productUrls = products.map((p) => ({
    url: `${base}/oils/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));
  return [...pages, ...productUrls, ...policies];
}
