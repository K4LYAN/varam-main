import { db } from "@/lib/data";
import { AdminTitle } from "@/components/admin/ui";
import { CategoriesManager } from "@/components/admin/Managers";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([db.categories(), db.allProducts()]);
  const counts: Record<string, number> = {};
  for (const p of products) if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
  return (
    <>
      <AdminTitle title="Categories" description="Categories group oils on the shop page and in the footer. Empty categories are hidden from customers." />
      <CategoriesManager categories={categories} counts={counts} />
    </>
  );
}
