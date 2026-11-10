import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/data";
import { AdminTitle } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([db.productById(id), db.categories()]);
  if (!product) notFound();
  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-ink">
        ← All products
      </Link>
      <div className="mt-3">
        <AdminTitle title={product.name} description={`Last updated ${new Date(product.updatedAt).toLocaleString("en-IN")}`} />
      </div>
      <ProductForm key={product.updatedAt} product={product} categories={categories} />
    </>
  );
}
