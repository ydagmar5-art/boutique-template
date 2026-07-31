import Link from "next/link";
import ProductForm from "@/components/admin/ProductForm";
import { listCategories } from "@/lib/actions/categories";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await listCategories();
  return (
    <div>
      <Link href="/admin/products" className="text-sm text-muted hover:text-ink">
        ← Catalogue
      </Link>
      <h1 className="mb-8 mt-3 font-heading text-3xl">Nouveau produit</h1>
      <div className="rounded-2xl border border-line bg-surface p-6">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
