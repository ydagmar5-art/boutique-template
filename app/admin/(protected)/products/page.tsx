import Link from "next/link";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { listProducts } from "@/lib/actions/products";
import DeleteProductButton from "@/components/admin/DeleteProductButton";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const products = await listProducts();

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl">Catalogue</h1>
          <p className="text-sm text-muted">{products.length} produits</p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-primary-dark"
        >
          + Ajouter un produit
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-6 py-3 font-medium">Produit</th>
              <th className="px-6 py-3 font-medium">Collection</th>
              <th className="px-6 py-3 font-medium">Stock</th>
              <th className="px-6 py-3 text-right font-medium">Prix</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock = p.variants.reduce((n, v) => n + v.stock, 0);
              return (
                <tr key={p.slug} className="border-t border-line">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.images[0]} alt={p.name} className="h-11 w-9 rounded-md object-cover" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted">{p.variants.length} variantes</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-muted">{p.collection}</td>
                  <td className="px-6 py-3.5">
                    {p.manageStock ? (
                      <span className={stock > 10 ? "text-organic" : stock > 0 ? "text-primary-dark" : "text-secondary"}>
                        {stock} en stock
                      </span>
                    ) : (
                      <span className="text-muted">Non géré</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {formatPrice(p.price, brand.currency, brand.locale)}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-4">
                      <Link href={`/admin/products/${p.slug}/edit`} className="text-sm text-muted hover:text-ink">
                        Modifier
                      </Link>
                      <DeleteProductButton slug={p.slug} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
