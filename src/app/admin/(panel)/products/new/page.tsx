import Link from "next/link";
import { db } from "@/lib/data";
import { AdminTitle } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const categories = await db.categories();
  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-ink">
        ← All products
      </Link>
      <div className="mt-3">
        <AdminTitle title="New product" />
      </div>
      <ProductForm categories={categories} />
    </>
  );
}
