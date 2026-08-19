import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand.config";
import { SOURCE_LABEL, type SourceVente } from "@/lib/attribution";
import { formatPrice } from "@/lib/products";
import { getOrder } from "@/lib/actions/orders";
import { statusLabel, STATUS_STYLE } from "@/lib/db/seed";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import DeleteOrderButton from "@/components/admin/DeleteOrderButton";
import ArchiveOrderButton from "@/components/admin/ArchiveOrderButton";
import TrackingCard from "@/components/admin/TrackingCard";

export const dynamic = "force-dynamic";

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const subtotal = order.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const itemsTotal = subtotal || order.total;

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">
        ← Commandes
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl">{order.id}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[order.status]}`}>
            {statusLabel(order.status)}
          </span>
          {order.archived && (
            <span className="rounded-full bg-line px-2.5 py-1 text-xs font-medium text-muted">
              Archivée
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <OrderStatusSelect id={order.id} status={order.status} tracking={order.tracking} />
          <ArchiveOrderButton id={order.id} archived={order.archived} />
          <DeleteOrderButton
            id={order.id}
            redirectTo="/admin/orders"
            className="rounded-full border border-secondary/40 px-4 py-1.5 text-sm text-secondary hover:bg-secondary/10"
            label="Supprimer"
          />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">Passée le {order.date}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Articles */}
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-6 py-4">
            <h2 className="font-medium">Articles</h2>
          </div>
          {order.items.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">
              Détail des articles non disponible pour cette commande.
            </p>
          ) : (
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-3 font-medium">Produit</th>
                  <th className="px-6 py-3 font-medium">Qté</th>
                  <th className="px-6 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-6 py-3.5">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted">{it.variantLabel}</div>
                    </td>
                    <td className="px-6 py-3.5">×{it.qty}</td>
                    <td className="px-6 py-3.5 text-right">
                      {formatPrice(it.unitPrice * it.qty, brand.currency, brand.locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="space-y-2 border-t border-line px-6 py-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>Sous-total</span>
              <span className="text-ink">
                {formatPrice(itemsTotal, brand.currency, brand.locale)}
              </span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Livraison</span>
              <span className="text-ink">Offerte</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium">
              <span>Total</span>
              <span className="font-heading text-lg">
                {formatPrice(order.total, brand.currency, brand.locale)}
              </span>
            </div>
          </div>
        </div>

        {/* Client & paiement */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-3 font-medium">Client</h2>
            <p className="text-sm">{order.customer}</p>
            <a href={`mailto:${order.email}`} className="block text-sm text-primary-dark hover:underline">
              {order.email}
            </a>
            {/* Cliquable : un appui suffit pour appeler la cliente depuis le téléphone. */}
            {order.phone && (
              <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="text-sm text-primary-dark hover:underline">
                {order.phone}
              </a>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-3 font-medium">Livraison</h2>
            <p className="text-sm text-muted">
              {order.address || "Adresse non renseignée"}
            </p>
          </div>
          <TrackingCard id={order.id} tracking={order.tracking} />
          {/* Preuve datée que le suivi est parti chez le processeur : c'est
              cette trace qui sert de défense en cas de contestation. */}
          {order.trackingSentAt && (
            <p className="-mt-3 px-1 text-xs text-muted">
              Suivi transmis à {order.psp} le{" "}
              {new Date(order.trackingSentAt).toLocaleDateString("fr-FR")}
            </p>
          )}
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-3 font-medium">Paiement</h2>
            <p className="text-sm">
              Réglé via <span className="font-medium">{order.psp}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {formatPrice(order.total, brand.currency, brand.locale)}
            </p>
            {/* Origine de la PREMIÈRE visite, pas du dernier clic — cf. lib/attribution.ts */}
            {/* Référence chez le PSP : sert à rapprocher la commande de
                l'encaissement, et à retrouver la transaction en cas de litige. */}
            {order.pspRef && (
              <p className="mt-3 break-all font-mono text-xs text-muted">
                {order.pspRef}
              </p>
            )}
            <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
              Origine :{" "}
              <span className="text-ink">
                {SOURCE_LABEL[(order.source ?? "direct") as SourceVente] ??
                  order.source}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
