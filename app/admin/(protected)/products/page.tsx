import Link from "next/link";
import { listProducts } from "@/lib/actions/products";
import ProductsTable from "@/components/admin/ProductsTable";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const products = await listProducts();
  const hiddenCount = products.filter((p) => p.hidden).length;

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl">Catalogue</h1>
          <p className="text-sm text-muted">
            {products.length} produits
            {hiddenCount > 0 && ` · ${hiddenCount} masqué${hiddenCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-primary-dark"
        >
          + Ajouter un produit
        </Link>
      </header>

      {/* Le classement se fait à la main, en glissant les lignes. */}
      <ProductsTable products={products} />
    </div>
  );
}
