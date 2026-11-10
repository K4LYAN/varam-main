import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1, "Required").max(max);

/** Accepts https URLs and locally served uploads (/uploads/…). Empty allowed. */
export const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v) || /^\/uploads\/[a-z0-9-]+\.(jpg|jpeg|png|webp|avif)$/i.test(v), {
    message: "Must be an https:// URL or an uploaded image",
  });

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), { message: "Must start with https://" });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

export const variantSchema = z.object({
  id: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/),
  label: required(40),
  price: z.coerce.number().min(0, "Price cannot be negative").max(1_000_000),
  available: z.boolean(),
  sku: text(60).optional(),
});

export const productSchema = z.object({
  name: required(120),
  slug: slugSchema,
  categoryId: z.string().trim().max(60).nullable(),
  shortDescription: text(300),
  description: text(5000),
  ingredients: text(1000),
  extractionProcess: text(3000),
  storage: text(1000),
  uses: text(1500),
  specifications: z.array(z.object({ label: required(60), value: required(200) })).max(30),
  images: z.array(imageUrl.refine((v) => v !== "", "Image URL required")).max(12),
  variants: z
    .array(variantSchema)
    .min(1, "Add at least one bottle size")
    .max(12)
    .refine((vs) => new Set(vs.map((v) => v.id)).size === vs.length, "Each size must be unique"),
  oilTone: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #D7A436"),
  featured: z.boolean(),
  isNew: z.boolean(),
  available: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10000),
});
export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: required(80),
  slug: slugSchema,
  description: text(500),
  sortOrder: z.coerce.number().int().min(0).max(10000),
});

export const testimonialSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  source: z.enum(["google", "customer"]),
  date: text(40),
  name: required(80),
  location: text(80),
  quote: required(1000),
  published: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10000),
});

export const settingsSchema = z.object({
  brand: z.object({ tagline: text(160), description: text(600), announcement: text(200) }),
  hero: z.object({
    eyebrow: text(80),
    headline: required(160),
    subtext: text(400),
    image: imageUrl,
    imageAlt: text(200),
  }),
  contact: z.object({
    whatsappNumber: z
      .string()
      .trim()
      .max(20)
      .refine((v) => v === "" || /^\+?[0-9 ()-]{10,20}$/.test(v), "Enter digits with country code, e.g. 91XXXXXXXXXX"),
    phone: text(40),
    email: z.union([z.literal(""), z.email().max(120)]),
    address: text(400),
    hours: text(120),
  }),
  social: z.object({
    instagram: optionalUrl,
    instagramHandle: text(60),
    facebook: optionalUrl,
    youtube: optionalUrl,
  }),
  story: z.object({
    eyebrow: text(60),
    title: required(200),
    intro: text(600),
    body: text(8000),
    quote: text(300),
    image: imageUrl,
    secondaryImage: imageUrl,
  }),
  pillars: z.array(z.object({ title: required(80), text: text(300) })).max(8),
  process: z.array(z.object({ title: required(80), text: text(500), image: imageUrl })).max(8),
  ingredients: z.array(z.object({ name: required(60), text: text(300), image: imageUrl })).max(12),
  gallery: z.array(z.object({ image: imageUrl.refine((v) => v !== "", "Image required"), alt: text(200) })).max(12),
  stores: z
    .array(
      z.object({
        name: required(120),
        address: required(400),
        phone: text(40),
        hours: text(120),
        mapsUrl: optionalUrl,
        mapQuery: text(300),
      }),
    )
    .max(20),
  reviews: z.object({
    rating: z.coerce.number().min(0).max(5),
    count: z.coerce.number().int().min(0).max(1_000_000),
    url: optionalUrl,
    writeUrl: optionalUrl,
  }),
  policies: z.object({ privacy: text(20000), terms: text(20000), shipping: text(20000), returns: text(20000) }),
  analytics: z.object({ reportUrl: optionalUrl }),
});

export const loginSchema = z.object({
  email: z.string().trim().max(120),
  password: z.string().min(1).max(200),
});

export function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.join(" › ");
  return path ? `${path}: ${issue.message}` : issue.message;
}
