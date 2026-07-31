import { listCategories } from "@/lib/actions/categories";
import CategoriesManager from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-heading text-3xl">Catégories</h1>
        <p className="text-sm text-muted">Créez et supprimez les catégories de produits.</p>
      </header>
      <CategoriesManager categories={categories} />
    </div>
  );
}
