import PromotionsManager from "@/components/admin/PromotionsManager";
import { listPromotions } from "@/lib/actions/promotions";
import { listProducts } from "@/lib/actions/products";
import { listCategories } from "@/lib/actions/categories";

export const dynamic = "force-dynamic";

export default async function AdminPromotions() {
  const [promotions, products, categories] = await Promise.all([
    listPromotions(),
    listProducts(),
    listCategories(),
  ]);

  const actives = promotions.filter((p) => p.enabled).length;

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-heading text-3xl">Offres & codes promo</h1>
        <p className="text-sm text-muted">
          {promotions.length} offre(s) · {actives} active(s)
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Une offre <strong>sans code</strong> s&apos;applique toute seule au
          panier ; avec un <strong>code</strong>, le client doit le saisir au
          paiement. Si plusieurs offres automatiques peuvent s&apos;appliquer, la
          boutique retient la plus avantageuse pour le client — un code promo,
          lui, se cumule par-dessus.
        </p>
      </header>

      <PromotionsManager
        initial={promotions}
        categories={categories}
        products={products.map((p) => ({ slug: p.slug, name: p.name }))}
      />
    </div>
  );
}
