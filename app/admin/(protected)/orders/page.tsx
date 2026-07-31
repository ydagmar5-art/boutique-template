import { listOrders } from "@/lib/actions/orders";
import OrdersTable from "@/components/admin/OrdersTable";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  const orders = await listOrders();

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-heading text-3xl">Commandes</h1>
        <p className="text-sm text-muted">
          {orders.filter((o) => !o.archived).length} à traiter · {orders.length} au total
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-muted">
          Aucune commande pour l&apos;instant.
        </div>
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}
