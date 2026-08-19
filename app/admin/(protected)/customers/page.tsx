import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { listCustomers } from "@/lib/actions/orders";

export const dynamic = "force-dynamic";

export default async function AdminCustomers() {
  const customers = await listCustomers();

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-heading text-3xl">Clients</h1>
        <p className="text-sm text-muted">{customers.length} clients</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[38rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-6 py-3 font-medium">Client</th>
              <th className="px-6 py-3 font-medium">E-mail</th>
              <th className="px-6 py-3 font-medium">Commandes</th>
              <th className="px-6 py-3 text-right font-medium">Total dépensé</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-line hover:bg-bg/50">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-halo text-xs font-medium text-primary-dark">
                      {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-muted">{c.email}</td>
                <td className="px-6 py-3.5">{c.orders}</td>
                <td className="px-6 py-3.5 text-right">
                  {formatPrice(c.spent, brand.currency, brand.locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
