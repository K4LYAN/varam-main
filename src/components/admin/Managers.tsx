"use client";

import type { Category, Testimonial } from "@/lib/types";
import { slugify } from "@/lib/format";
import { deleteCategory, deleteTestimonial, saveCategory, saveTestimonial } from "@/app/admin/actions";
import { CollectionManager } from "./CollectionManager";
import { Field, Toggle } from "./ui";

type CatDraft = { name: string; slug: string; description: string; sortOrder: number };

export function CategoriesManager({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  return (
    <CollectionManager<Category, CatDraft>
      items={categories}
      empty="No categories yet."
      addLabel="New category"
      blank={{ name: "", slug: "", description: "", sortOrder: categories.length }}
      toDraft={(c) => ({ name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder })}
      onSave={(id, d) => saveCategory(id, d)}
      onDelete={(id) => deleteCategory(id)}
      deleteConfirm={(c) => `Delete the category “${c.name}”?`}
      renderRow={(c) => (
        <>
          <p className="font-semibold">{c.name}</p>
          <p className="text-xs text-muted">
            /oils?category={c.slug} · {counts[c.id] ?? 0} product{(counts[c.id] ?? 0) === 1 ? "" : "s"}
          </p>
        </>
      )}
      renderForm={(d, set) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className="field" value={d.name} onChange={(e) => set({ name: e.target.value, slug: d.slug || slugify(e.target.value) })} />
          </Field>
          <Field label="Slug">
            <input className="field" value={d.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <input className="field" value={d.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="Sort order">
            <input className="field" type="number" min={0} value={d.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
          </Field>
        </div>
      )}
    />
  );
}

type TDraft = { name: string; location: string; quote: string; published: boolean; sortOrder: number; rating: number; source: "google" | "customer"; date: string };

export function TestimonialsManager({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <CollectionManager<Testimonial, TDraft>
      items={testimonials}
      empty="No testimonials yet. The testimonials section stays hidden on the website until you add one."
      addLabel="Add testimonial"
      blank={{ name: "", location: "", quote: "", published: true, sortOrder: testimonials.length, rating: 5, source: "google", date: "" }}
      toDraft={(t) => ({ name: t.name, location: t.location, quote: t.quote, published: t.published, sortOrder: t.sortOrder, rating: t.rating, source: t.source, date: t.date })}
      onSave={(id, d) => saveTestimonial(id, d)}
      onDelete={(id) => deleteTestimonial(id)}
      deleteConfirm={(t) => `Delete the testimonial from ${t.name}?`}
      renderRow={(t) => (
        <>
          <p className="mb-1 text-xs font-semibold text-accent">
            {"★".repeat(t.rating)}
            <span className="ml-2 rounded-full bg-cream px-2 py-0.5 font-medium text-muted">{t.source === "google" ? "Google review" : "Customer"}</span>
            {t.date && <span className="ml-2 font-normal text-muted">{t.date}</span>}
          </p>
          <p className="text-sm leading-relaxed">“{t.quote}”</p>
          <p className="mt-1 text-xs text-muted">
            — {t.name}
            {t.location && `, ${t.location}`} {!t.published && <span className="ml-2 text-copper">(hidden)</span>}
          </p>
        </>
      )}
      renderForm={(d, set) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source">
            <select className="field" value={d.source} onChange={(e) => set({ source: e.target.value as "google" | "customer" })}>
              <option value="google">Google review (shown as a Google review card)</option>
              <option value="customer">Direct customer feedback</option>
            </select>
          </Field>
          <Field label="Stars">
            <select className="field" value={d.rating} onChange={(e) => set({ rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date (optional)" hint="e.g. “2 months ago” or “March 2026”">
            <input className="field" value={d.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Reviewer name" hint="As shown on Google, or the name the customer agreed to share">
            <input className="field" value={d.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="City / location (optional)">
            <input className="field" value={d.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label="Feedback" className="sm:col-span-2">
            <textarea className="field min-h-28" value={d.quote} onChange={(e) => set({ quote: e.target.value })} />
          </Field>
          <Toggle checked={d.published} onChange={(v) => set({ published: v })} label="Show on website" />
          <Field label="Sort order">
            <input className="field" type="number" min={0} value={d.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
          </Field>
        </div>
      )}
    />
  );
}
