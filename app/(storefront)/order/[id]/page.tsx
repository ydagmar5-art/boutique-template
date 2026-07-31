import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { getOrder } from "@/lib/actions/orders";
import { listProducts } from "@/lib/actions/products";
import { carrierLabel, trackingUrl } from "@/lib/carriers";
import PurchasePixel from "@/components/site/PurchasePixel";
import ClearCart from "@/components/site/ClearCart";

export const dynamic = "force-dynamic";

export default async function OrderConfirmation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  // La commande ne stocke pas la collection : on la retrouve dans le catalogue
  // pour envoyer la catégorie produit aux régies publicitaires.
  const collections = new Map(
    (await listProducts()).map((p) => [p.slug, p.collection]),
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <PurchasePixel
        id={order.id}
        value={order.total / 100}
        email={order.email}
        items={order.items.map((it) => ({
          id: it.slug,
          name: it.name,
          category: collections.get(it.slug),
          price: it.unitPrice / 100,
          quantity: it.qty,
        }))}
      />
      <ClearCart />
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-halo text-2xl text-primary-dark">
          ✓
        </span>
        <h1 className="font-heading text-4xl">Merci {order.customer.split(" ")[0]} !</h1>
        <p className="mt-3 text-muted">
          Votre commande <span className="font-medium text-ink">{order.id}</span> est
          confirmée. Un e-mail de suivi part vers {order.email}.
        </p>
      </div>

      {order.tracking?.number && (
        <div className="mt-10 rounded-2xl border border-line border-l-4 border-l-primary bg-surface p-6">
          <p className="text-xs uppercase tracking-widest text-muted">
            Suivi {carrierLabel(order.tracking.carrier)}
          </p>
          <p className="mt-1 font-mono text-lg">{order.tracking.number}</p>
          {trackingUrl(order.tracking) && (
            <a
              href={trackingUrl(order.tracking)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90"
            >
              Suivre mon colis
            </a>
          )}
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-line bg-surface p-6">
        <div className="space-y-4">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {it.name}{" "}
                <span className="text-muted">
                  · {it.variantLabel} · ×{it.qty}
                </span>
              </span>
              <span>{formatPrice(it.unitPrice * it.qty, brand.currency, brand.locale)}</span>
            </div>
          ))}
          {order.items.length === 0 && (
            <p className="text-sm text-muted">Récapitulatif indisponible.</p>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
          <span className="font-medium">Total payé</span>
          <span className="font-heading text-2xl">
            {formatPrice(order.total, brand.currency, brand.locale)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">Réglé via {order.psp}</p>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/products"
          className="rounded-full bg-ink px-8 py-3.5 text-sm font-medium text-bg hover:bg-primary-dark"
        >
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
