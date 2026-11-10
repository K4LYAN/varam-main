"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Category, Product, Spec, Variant } from "@/lib/types";
import { slugify } from "@/lib/format";
import { saveProduct } from "@/app/admin/actions";
import { BottleArt } from "@/components/product/BottleArt";
import { toast } from "@/store/toast";
import { Card, Field, ImageField, Toggle } from "./ui";

type Draft = Omit<Product, "id" | "categoryName" | "categorySlug" | "createdAt" | "updatedAt">;

const blank: Draft = {
  slug: "",
  name: "",
  categoryId: null,
  shortDescription: "",
  description: "",
  ingredients: "",
  extractionProcess: "",
  uses: "",
  storage: "Store in a cool, dry place away from direct sunlight. Close the cap tightly after every use.",
  specifications: [{ label: "Type", value: "Cold-pressed, unrefined" }],
  images: [],
  variants: [{ id: "500-ml", label: "500 ML", price: 0, available: true }],
  oilTone: "#D7A436",
  featured: false,
  isNew: true,
  available: true,
  sortOrder: 100,
};

export function ProductForm({ product, categories }: { product?: Product; categories: Category[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<Draft>(() => (product ? { ...product } : { ...blank, categoryId: categories[0]?.id ?? null }));
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  const setVariant = (i: number, patch: Partial<Variant>) =>
    set(
      "variants",
      d.variants.map((v, idx) => {
        if (idx !== i) return v;
        const next = { ...v, ...patch };
        if (patch.label !== undefined) next.id = slugify(patch.label) || v.id;
        return next;
      }),
    );
  const setSpec = (i: number, patch: Partial<Spec>) =>
    set("specifications", d.specifications.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const copy = [...arr];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveProduct(product?.id ?? null, {
        ...d,
        images: d.images.filter(Boolean),
        variants: d.variants.map((v) => ({ ...v, price: Number(v.price) })),
      });
      if (!res.ok) {
        toast({ title: "Please check the form", description: res.error, tone: "warning" });
        return;
      }
      toast({ title: product ? "Product saved" : "Product created", description: "Changes are live on the website." });
      if (!product && res.id) router.replace(`/admin/products/${res.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" className="sm:col-span-2">
              <input
                className="field"
                value={d.name}
                required
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="URL slug" hint={`Page address: /oils/${d.slug || "…"}`}>
              <input
                className="field"
                value={d.slug}
                required
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="Category">
              <select className="field" value={d.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Short description" hint="Shown on product cards (1–2 sentences)" className="sm:col-span-2">
              <textarea className="field min-h-20" value={d.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Bottle sizes & prices" description="Each size has its own price in ₹. Switch a size off when it is out of stock.">
          <div className="space-y-3">
            {d.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_auto_auto] items-center gap-2 sm:gap-3">
                <input className="field" value={v.label} placeholder="e.g. 1 Litre" onChange={(e) => setVariant(i, { label: e.target.value })} aria-label="Size label" />
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">₹</span>
                  <input
                    className="field pl-7 tabular-nums"
                    type="number"
                    min={0}
                    step="0.01"
                    value={Number.isFinite(v.price) ? v.price : ""}
                    onChange={(e) => setVariant(i, { price: e.target.value === "" ? 0 : Number(e.target.value) })}
                    aria-label="Price"
                  />
                </div>
                <Toggle checked={v.available} onChange={(x) => setVariant(i, { available: x })} label="" ariaLabel={`${v.label} available`} />
                <button
                  type="button"
                  onClick={() => set("variants", d.variants.filter((_, idx) => idx !== i))}
                  disabled={d.variants.length <= 1}
                  className="grid h-9 w-9 place-items-center rounded-full text-copper hover:bg-copper/10 disabled:opacity-30"
                  aria-label="Remove size"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => set("variants", [...d.variants, { id: `size-${d.variants.length + 1}`, label: "", price: 0, available: true }])}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
          >
            <Plus className="h-4 w-4" /> Add size
          </button>
        </Card>

        <Card title="Product details">
          <div className="grid gap-4">
            <Field label="Description">
              <textarea className="field min-h-32" value={d.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Ingredients">
              <textarea className="field min-h-16" value={d.ingredients} onChange={(e) => set("ingredients", e.target.value)} />
            </Field>
            <Field label="Extraction process">
              <textarea className="field min-h-24" value={d.extractionProcess} onChange={(e) => set("extractionProcess", e.target.value)} />
            </Field>
            <Field label="How to use" hint="Kitchen and household uses shown on the product page">
              <textarea className="field min-h-20" value={d.uses} onChange={(e) => set("uses", e.target.value)} />
            </Field>
            <Field label="Storage instructions">
              <textarea className="field min-h-16" value={d.storage} onChange={(e) => set("storage", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Specifications" description="Label / value pairs shown in the product's specification table.">
          <div className="space-y-2">
            {d.specifications.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <input className="field" value={s.label} placeholder="Label" onChange={(e) => setSpec(i, { label: e.target.value })} aria-label="Specification label" />
                <input className="field" value={s.value} placeholder="Value" onChange={(e) => setSpec(i, { value: e.target.value })} aria-label="Specification value" />
                <button type="button" onClick={() => set("specifications", d.specifications.filter((_, idx) => idx !== i))} className="grid h-10 w-10 place-items-center rounded-full text-copper hover:bg-copper/10" aria-label="Remove specification">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => set("specifications", [...d.specifications, { label: "", value: "" }])} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Plus className="h-4 w-4" /> Add specification
          </button>
        </Card>

        <Card title="Photographs" description="The first photo is the main image. Without photos, a rendered VARAM bottle is shown.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.images.map((src, i) => (
              <div key={i}>
                <ImageField
                  label={i === 0 ? "Main image" : `Image ${i + 1}`}
                  value={src}
                  aspect="aspect-[4/5]"
                  onChange={(url) => set("images", d.images.map((x, idx) => (idx === i ? url : x)))}
                  onError={(m) => toast({ title: "Upload failed", description: m, tone: "warning" })}
                />
                <div className="mt-2 flex gap-1">
                  <button type="button" onClick={() => set("images", move(d.images, i, -1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" aria-label="Move earlier">
                    <ArrowUp className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                  <button type="button" onClick={() => set("images", move(d.images, i, 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" aria-label="Move later">
                    <ArrowDown className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                  <button type="button" onClick={() => set("images", d.images.filter((_, idx) => idx !== i))} className="ml-auto text-xs text-copper hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          {d.images.length < 12 && (
            <button type="button" onClick={() => set("images", [...d.images, ""])} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
              <Plus className="h-4 w-4" /> Add photo
            </button>
          )}
        </Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
        <Card title="Visibility">
          <div className="flex flex-col gap-4">
            <Toggle checked={d.available} onChange={(v) => set("available", v)} label="Available to order" />
            <Toggle checked={d.featured} onChange={(v) => set("featured", v)} label="Featured on homepage" />
            <Toggle checked={d.isNew} onChange={(v) => set("isNew", v)} label="New arrival" />
            <Field label="Sort order" hint="Lower numbers appear first">
              <input className="field" type="number" min={0} value={d.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
            </Field>
          </div>
        </Card>
        <Card title="Bottle render" description="Oil colour used when no photo is uploaded.">
          <div className="flex items-end gap-4">
            <div className="h-44 rounded-xl bg-cream px-3 pt-3">
              <BottleArt name={d.name || "Oil"} tone={d.oilTone} size={d.variants[0]?.label} className="h-full w-auto" />
            </div>
            <div className="flex-1">
              <Field label="Oil colour">
                <div className="flex gap-2">
                  <input type="color" value={d.oilTone} onChange={(e) => set("oilTone", e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-line" aria-label="Pick colour" />
                  <input className="field" value={d.oilTone} onChange={(e) => set("oilTone", e.target.value)} />
                </div>
              </Field>
            </div>
          </div>
        </Card>
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Saving…" : product ? "Save changes" : "Create product"}
        </button>
        {product && (
          <a href={`/oils/${product.slug}`} target="_blank" className="block text-center text-sm text-brand hover:underline">
            View on website ↗
          </a>
        )}
      </div>
    </form>
  );
}
