"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { SiteSettings } from "@/lib/types";
import { saveSettings } from "@/app/admin/actions";
import { buildWhatsAppUrl, isWhatsAppNumberConfigured, normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { toast } from "@/store/toast";
import { Card, Field, ImageField } from "./ui";

type FieldSpec<T> = { key: keyof T & string; label: string; type?: "text" | "textarea" | "image" };

function ListEditor<T extends Record<string, string>>({
  items,
  onChange,
  fields,
  blank,
  max,
  itemLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  fields: FieldSpec<T>[];
  blank: T;
  max: number;
  itemLabel: string;
}) {
  const update = (i: number, patch: Partial<T>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const imageField = fields.find((f) => f.type === "image");
  const textFields = fields.filter((f) => f.type !== "image");
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">
              {itemLabel} {i + 1}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="grid h-8 w-8 place-items-center rounded-full text-copper hover:bg-copper/10" aria-label="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className={imageField ? "grid gap-4 sm:grid-cols-[200px_1fr]" : "grid gap-3"}>
            {imageField && (
              <ImageField
                label={imageField.label}
                value={item[imageField.key] ?? ""}
                onChange={(url) => update(i, { [imageField.key]: url } as Partial<T>)}
                onError={(m) => toast({ title: "Upload failed", description: m, tone: "warning" })}
              />
            )}
            <div className="grid gap-3">
              {textFields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.type === "textarea" ? (
                    <textarea className="field min-h-20" value={item[f.key] ?? ""} onChange={(e) => update(i, { [f.key]: e.target.value } as Partial<T>)} />
                  ) : (
                    <input className="field" value={item[f.key] ?? ""} onChange={(e) => update(i, { [f.key]: e.target.value } as Partial<T>)} />
                  )}
                </Field>
              ))}
            </div>
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, { ...blank }])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
          <Plus className="h-4 w-4" /> Add {itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}

const SECTIONS = [
  ["contact", "Contact & WhatsApp"],
  ["hero", "Homepage banner"],
  ["brand", "Brand"],
  ["story", "Brand story"],
  ["pillars", "Why VARAM"],
  ["process", "Process"],
  ["ingredients", "Ingredients"],
  ["gallery", "Gallery"],
  ["stores", "Stores"],
  ["reviews", "Google reviews"],
  ["social", "Social media"],
  ["policies", "Policies"],
] as const;

export function ContentEditor({ initial, envNumber }: { initial: SiteSettings; envNumber: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState<SiteSettings>(initial);
  const patch = <K extends keyof SiteSettings>(k: K, v: Partial<SiteSettings[K]>) =>
    setS((cur) => ({ ...cur, [k]: Array.isArray(v) ? v : { ...(cur[k] as object), ...v } }));
  const onError = (m: string) => toast({ title: "Upload failed", description: m, tone: "warning" });

  const number = s.contact.whatsappNumber || envNumber;
  const numberOk = isWhatsAppNumberConfigured(number);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSettings(s);
      if (!res.ok) return toast({ title: "Please check the form", description: res.error, tone: "warning" });
      toast({ title: "Website content saved", description: "Changes are live." });
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[200px_1fr]">
      <nav className="hidden xl:block">
        <ul className="sticky top-8 space-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-muted hover:bg-white hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 space-y-6">
        <Card title="Contact & WhatsApp" className="scroll-mt-6" description="All WhatsApp buttons on the website send messages to this number.">
          <div id="contact" className="grid gap-4 sm:grid-cols-2">
            <Field
              label="WhatsApp business number"
              hint={
                s.contact.whatsappNumber
                  ? `Normalised: ${normalizeWhatsAppNumber(s.contact.whatsappNumber)}`
                  : envNumber
                    ? `Empty — using NEXT_PUBLIC_WHATSAPP_NUMBER (${envNumber})`
                    : "Include the country code, e.g. 91XXXXXXXXXX"
              }
            >
              <input className="field" inputMode="tel" value={s.contact.whatsappNumber} placeholder="91XXXXXXXXXX" onChange={(e) => patch("contact", { whatsappNumber: e.target.value })} />
            </Field>
            <div className="flex items-end">
              {numberOk ? (
                <a href={buildWhatsAppUrl(number, "Test message from the VARAM website admin")} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp min-h-11">
                  Test this number
                </a>
              ) : (
                <p className="text-xs text-copper">No valid number yet — WhatsApp will ask customers to pick a contact.</p>
              )}
            </div>
            <Field label="Phone (display)">
              <input className="field" value={s.contact.phone} onChange={(e) => patch("contact", { phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={s.contact.email} onChange={(e) => patch("contact", { email: e.target.value })} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <textarea className="field min-h-20" value={s.contact.address} onChange={(e) => patch("contact", { address: e.target.value })} />
            </Field>
            <Field label="Business hours" className="sm:col-span-2">
              <input className="field" value={s.contact.hours} onChange={(e) => patch("contact", { hours: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Homepage banner">
          <div id="hero" className="grid scroll-mt-6 gap-4 sm:grid-cols-[260px_1fr]">
            <ImageField label="Hero image" value={s.hero.image} aspect="aspect-[4/5]" onChange={(v) => patch("hero", { image: v })} onError={onError} />
            <div className="grid gap-4">
              <Field label="Small heading">
                <input className="field" value={s.hero.eyebrow} onChange={(e) => patch("hero", { eyebrow: e.target.value })} />
              </Field>
              <Field label="Headline" hint="A full stop splits it into two lines; the second line is italic and golden.">
                <input className="field" value={s.hero.headline} onChange={(e) => patch("hero", { headline: e.target.value })} />
              </Field>
              <Field label="Supporting text">
                <textarea className="field min-h-20" value={s.hero.subtext} onChange={(e) => patch("hero", { subtext: e.target.value })} />
              </Field>
              <Field label="Image description (for accessibility)">
                <input className="field" value={s.hero.imageAlt} onChange={(e) => patch("hero", { imageAlt: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Brand">
          <div id="brand" className="grid scroll-mt-6 gap-4">
            <Field label="Tagline">
              <input className="field" value={s.brand.tagline} onChange={(e) => patch("brand", { tagline: e.target.value })} />
            </Field>
            <Field label="Brand description" hint="Used on the homepage intro, footer and search engines.">
              <textarea className="field min-h-24" value={s.brand.description} onChange={(e) => patch("brand", { description: e.target.value })} />
            </Field>
            <Field label="Announcement bar" hint="Leave empty to hide.">
              <input className="field" value={s.brand.announcement} onChange={(e) => patch("brand", { announcement: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Brand story">
          <div id="story" className="grid scroll-mt-6 gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField label="Main image" value={s.story.image} aspect="aspect-[4/5]" onChange={(v) => patch("story", { image: v })} onError={onError} />
              <ImageField label="Secondary image" value={s.story.secondaryImage} aspect="aspect-[4/5]" onChange={(v) => patch("story", { secondaryImage: v })} onError={onError} />
            </div>
            <Field label="Small heading">
              <input className="field" value={s.story.eyebrow} onChange={(e) => patch("story", { eyebrow: e.target.value })} />
            </Field>
            <Field label="Title">
              <input className="field" value={s.story.title} onChange={(e) => patch("story", { title: e.target.value })} />
            </Field>
            <Field label="Introduction">
              <textarea className="field min-h-20" value={s.story.intro} onChange={(e) => patch("story", { intro: e.target.value })} />
            </Field>
            <Field label="Full story" hint="Separate paragraphs with a blank line. **bold** and _italic_ are supported.">
              <textarea className="field min-h-48" value={s.story.body} onChange={(e) => patch("story", { body: e.target.value })} />
            </Field>
            <Field label="Pull quote">
              <input className="field" value={s.story.quote} onChange={(e) => patch("story", { quote: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Why choose VARAM" description="Only include statements you can verify.">
          <div id="pillars" className="scroll-mt-6">
            <ListEditor items={s.pillars} onChange={(v) => setS((c) => ({ ...c, pillars: v }))} fields={[{ key: "title", label: "Title" }, { key: "text", label: "Text", type: "textarea" }]} blank={{ title: "", text: "" }} max={8} itemLabel="Point" />
          </div>
        </Card>

        <Card title="Extraction process">
          <div id="process" className="scroll-mt-6">
            <ListEditor
              items={s.process}
              onChange={(v) => setS((c) => ({ ...c, process: v }))}
              fields={[{ key: "image", label: "Image", type: "image" }, { key: "title", label: "Step title" }, { key: "text", label: "Description", type: "textarea" }]}
              blank={{ title: "", text: "", image: "" }}
              max={8}
              itemLabel="Step"
            />
          </div>
        </Card>

        <Card title="Ingredients">
          <div id="ingredients" className="scroll-mt-6">
            <ListEditor
              items={s.ingredients}
              onChange={(v) => setS((c) => ({ ...c, ingredients: v }))}
              fields={[{ key: "image", label: "Image", type: "image" }, { key: "name", label: "Name" }, { key: "text", label: "Short text", type: "textarea" }]}
              blank={{ name: "", text: "", image: "" }}
              max={12}
              itemLabel="Ingredient"
            />
          </div>
        </Card>

        <Card title="Instagram gallery" description="Up to 6 images are shown on the homepage.">
          <div id="gallery" className="scroll-mt-6">
            <ListEditor
              items={s.gallery}
              onChange={(v) => setS((c) => ({ ...c, gallery: v }))}
              fields={[{ key: "image", label: "Image", type: "image" }, { key: "alt", label: "Image description" }]}
              blank={{ image: "", alt: "" }}
              max={12}
              itemLabel="Photo"
            />
          </div>
        </Card>

        <Card title="Stores" description="Shown on the Stores page and homepage with an embedded Google Map.">
          <div id="stores" className="scroll-mt-6">
            <ListEditor
              items={s.stores}
              onChange={(v) => setS((c) => ({ ...c, stores: v }))}
              fields={[
                { key: "name", label: "Store name" },
                { key: "address", label: "Address", type: "textarea" },
                { key: "phone", label: "Phone" },
                { key: "hours", label: "Opening hours" },
                { key: "mapsUrl", label: "Google Maps link" },
                { key: "mapQuery", label: "Map search text (name + address, used for the map and directions)" },
              ]}
              blank={{ name: "", address: "", phone: "", hours: "", mapsUrl: "", mapQuery: "" }}
              max={20}
              itemLabel="Store"
            />
          </div>
        </Card>

        <Card
          title="Google reviews"
          description="Rating summary shown on the website. When GOOGLE_PLACES_API_KEY is set on the server, the live rating and latest reviews are loaded from Google automatically instead."
        >
          <div id="reviews" className="grid scroll-mt-6 gap-4 sm:grid-cols-2">
            <Field label="Rating (out of 5)">
              <input className="field" type="number" min={0} max={5} step="0.1" value={s.reviews.rating} onChange={(e) => patch("reviews", { rating: Number(e.target.value) })} />
            </Field>
            <Field label="Number of reviews">
              <input className="field" type="number" min={0} value={s.reviews.count} onChange={(e) => patch("reviews", { count: Number(e.target.value) })} />
            </Field>
            <Field label="Google reviews link">
              <input className="field" value={s.reviews.url} onChange={(e) => patch("reviews", { url: e.target.value })} />
            </Field>
            <Field label="“Write a review” link (optional)">
              <input className="field" value={s.reviews.writeUrl} placeholder="https://g.page/r/…/review" onChange={(e) => patch("reviews", { writeUrl: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Social media">
          <div id="social" className="grid scroll-mt-6 gap-4 sm:grid-cols-2">
            <Field label="Instagram URL">
              <input className="field" value={s.social.instagram} placeholder="https://instagram.com/…" onChange={(e) => patch("social", { instagram: e.target.value })} />
            </Field>
            <Field label="Instagram handle">
              <input className="field" value={s.social.instagramHandle} placeholder="varam" onChange={(e) => patch("social", { instagramHandle: e.target.value })} />
            </Field>
            <Field label="Facebook URL">
              <input className="field" value={s.social.facebook} onChange={(e) => patch("social", { facebook: e.target.value })} />
            </Field>
            <Field label="YouTube URL">
              <input className="field" value={s.social.youtube} onChange={(e) => patch("social", { youtube: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Policies" description="Use ## for headings, - for bullet points. Review with a legal adviser before publishing.">
          <div id="policies" className="grid scroll-mt-6 gap-4">
            {(
              [
                ["privacy", "Privacy Policy"],
                ["terms", "Terms & Conditions"],
                ["shipping", "Shipping Policy"],
                ["returns", "Cancellation & Return Policy"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <textarea className="field min-h-56 font-mono text-xs" value={s.policies[key]} onChange={(e) => patch("policies", { [key]: e.target.value })} />
              </Field>
            ))}
          </div>
        </Card>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <button type="submit" disabled={pending} className="btn btn-primary shadow-xl">
            {pending ? "Saving…" : "Save all changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
