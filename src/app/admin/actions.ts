"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { TAGS } from "@/lib/data";
import { endSession, isAdminConfigured, isRateLimited, requireAdmin, startSession, verifyCredentials } from "@/lib/auth";
import {
  categorySchema,
  firstError,
  loginSchema,
  productSchema,
  settingsSchema,
  testimonialSchema,
} from "@/lib/validation";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

function uniqueViolation(err: unknown) {
  const e = err as { code?: string; message?: string };
  return e?.code === "23505" || /duplicate key|unique/i.test(e?.message ?? "");
}

/* ---------------- Auth ---------------- */

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  if (!isAdminConfigured()) {
    return { error: "Admin login is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and AUTH_SECRET." };
  }
  if (await isRateLimited()) return { error: "Too many attempts. Please wait 15 minutes and try again." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const ok = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!ok) return { error: "Incorrect email or password." };
  await startSession(parsed.data.email.trim().toLowerCase());
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}

/* ---------------- Products ---------------- */

export async function saveProduct(id: string | null, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const p = parsed.data;
  const params = [
    p.slug,
    p.name,
    p.categoryId || null,
    p.shortDescription,
    p.description,
    p.ingredients,
    p.extractionProcess,
    p.storage,
    JSON.stringify(p.specifications),
    JSON.stringify(p.images),
    JSON.stringify(p.variants),
    p.oilTone,
    p.featured,
    p.isNew,
    p.available,
    p.sortOrder,
    p.uses,
  ];
  try {
    if (id) {
      const rows = await query<{ id: string }>(
        `update products set slug=$1, name=$2, category_id=$3, short_description=$4, description=$5, ingredients=$6,
          extraction_process=$7, storage=$8, specifications=$9::jsonb, images=$10::jsonb, variants=$11::jsonb,
          oil_tone=$12, featured=$13, is_new=$14, available=$15, sort_order=$16, uses=$17, updated_at=now()
         where id=$18 returning id`,
        [...params, id],
      );
      if (!rows.length) return fail("Product not found");
    } else {
      id = crypto.randomUUID();
      await query(
        `insert into products (slug, name, category_id, short_description, description, ingredients, extraction_process,
          storage, specifications, images, variants, oil_tone, featured, is_new, available, sort_order, uses, id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18)`,
        [...params, id],
      );
    }
  } catch (err) {
    if (uniqueViolation(err)) return fail("Another product already uses this URL slug.");
    console.error(err);
    return fail("Could not save the product. Please try again.");
  }
  updateTag(TAGS.catalog);
  return { ok: true, id };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || id.length > 80) return fail("Invalid id");
  await query("delete from products where id = $1", [id]);
  updateTag(TAGS.catalog);
  return { ok: true };
}

export async function setProductFlag(
  id: string,
  field: "available" | "featured" | "is_new",
  value: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const column = ({ available: "available", featured: "featured", is_new: "is_new" } as const)[field];
  if (!column || typeof value !== "boolean") return fail("Invalid field");
  await query(`update products set ${column} = $1, updated_at = now() where id = $2`, [value, id]);
  updateTag(TAGS.catalog);
  return { ok: true };
}

/* ---------------- Categories ---------------- */

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const c = parsed.data;
  try {
    if (id) {
      await query("update categories set name=$1, slug=$2, description=$3, sort_order=$4 where id=$5", [
        c.name,
        c.slug,
        c.description,
        c.sortOrder,
        id,
      ]);
    } else {
      id = `cat-${crypto.randomUUID().slice(0, 8)}`;
      await query("insert into categories (id, name, slug, description, sort_order) values ($1,$2,$3,$4,$5)", [
        id,
        c.name,
        c.slug,
        c.description,
        c.sortOrder,
      ]);
    }
  } catch (err) {
    if (uniqueViolation(err)) return fail("Another category already uses this slug.");
    console.error(err);
    return fail("Could not save the category.");
  }
  updateTag(TAGS.catalog);
  return { ok: true, id };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const used = await query<{ n: number }>("select count(*)::int as n from products where category_id = $1", [id]);
  if (Number(used[0]?.n) > 0) return fail("Move or delete the products in this category first.");
  await query("delete from categories where id = $1", [id]);
  updateTag(TAGS.catalog);
  return { ok: true };
}

/* ---------------- Testimonials ---------------- */

export async function saveTestimonial(id: string | null, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const t = parsed.data;
  if (id) {
    await query(
      "update testimonials set name=$1, location=$2, quote=$3, published=$4, sort_order=$5, rating=$6, source=$7, review_date=$8 where id=$9",
      [t.name, t.location, t.quote, t.published, t.sortOrder, t.rating, t.source, t.date, id],
    );
  } else {
    id = crypto.randomUUID();
    await query(
      "insert into testimonials (id, name, location, quote, published, sort_order, rating, source, review_date) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [id, t.name, t.location, t.quote, t.published, t.sortOrder, t.rating, t.source, t.date],
    );
  }
  updateTag(TAGS.testimonials);
  return { ok: true, id };
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  await requireAdmin();
  await query("delete from testimonials where id = $1", [id]);
  updateTag(TAGS.testimonials);
  return { ok: true };
}

/* ---------------- Site content ---------------- */

export async function saveSettings(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const data = parsed.data;
  data.contact.whatsappNumber = data.contact.whatsappNumber.replace(/\D/g, "");
  await query(
    `insert into settings (key, value, updated_at) values ('site', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(data)],
  );
  updateTag(TAGS.settings);
  return { ok: true };
}
