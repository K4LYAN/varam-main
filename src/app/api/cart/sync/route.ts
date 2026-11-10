import { NextResponse } from "next/server";
import { z } from "zod";
import { getProducts } from "@/lib/data";

const body = z.object({
  lines: z
    .array(z.object({ productId: z.string().max(80), variantId: z.string().max(80) }))
    .max(100),
});

/** Returns live price / availability for the cart lines a browser has stored. */
export async function POST(req: Request) {
  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const products = await getProducts();
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = parsed.data.lines.map(({ productId, variantId }) => {
    const p = byId.get(productId);
    const v = p?.variants.find((x) => x.id === variantId);
    if (!p || !v) return { productId, variantId, found: false, available: false };
    return {
      productId,
      variantId,
      found: true,
      available: p.available && v.available,
      name: p.name,
      slug: p.slug,
      size: v.label,
      price: v.price,
      image: p.images[0] ?? null,
      oilTone: p.oilTone,
      category: p.categoryName,
    };
  });
  return NextResponse.json({ lines }, { headers: { "Cache-Control": "no-store" } });
}
