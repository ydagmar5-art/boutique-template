import Link from "next/link";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { listOrders } from "@/lib/actions/orders";
import { statusLabel, STATUS_STYLE } from "@/lib/db/seed";
import StatsExplorer from "@/components/admin/StatsExplorer";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const orders = await listOrders();

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl">Tableau de bord</h1>
          <p className="text-sm text-muted">Vue d&apos;ensemble</p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-primary-dark"
        >
          + Ajouter un produit
        </Link>
      </header>

      {/* Sélecteur de période + graphique combiné audience / ventes / panier */}
      <StatsExplorer />

      <div className="mt-8 rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-medium">Commandes récentes</h2>
          <Link href="/admin/orders" className="text-sm text-primary-dark hover:underline">
            Tout voir →
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted">Aucune commande pour l&apos;instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-6 py-3 font-medium">Commande</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Paiement</th>
                <th className="px-6 py-3 font-medium">Statut</th>
                <th className="px-6 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-6 py-3.5 font-medium">
                    <Link href={`/admin/orders/${o.id}`} className="hover:text-primary-dark">
                      {o.id}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-muted">{o.customer}</td>
                  <td className="px-6 py-3.5 text-muted">{o.psp}</td>
                  <td className="px-6 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[o.status]}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {formatPrice(o.total, brand.currency, brand.locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
