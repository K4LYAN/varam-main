import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/data";
import { AdminTitle } from "@/components/admin/ui";
import { ProductsTable } from "@/components/admin/ProductsTable";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const products = await db.allProducts();
  return (
    <>
      <AdminTitle
        title="Products"
        description="Add, edit and remove oils. Toggle availability to mark a product out of stock without deleting it."
        actions={
          <Link href="/admin/products/new" className="btn btn-primary min-h-11">
            <Plus className="h-4 w-4" /> New product
          </Link>
        }
      />
      <ProductsTable products={products} />
    </>
  );
}
