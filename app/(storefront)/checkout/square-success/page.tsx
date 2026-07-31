import Link from "next/link";
import { redirect } from "next/navigation";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { createOrder } from "@/lib/actions/orders";
import { createOrderOnce } from "@/lib/payments/finalize";
import { read, write } from "@/lib/db/store";
import type { CheckoutDraft } from "@/lib/actions/checkout";

export const dynamic = "force-dynamic";

interface Pending {
  draft: CheckoutDraft;
  done: boolean;
  orderId: string | null;
}

export default async function SquareSuccess({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; transactionId?: string }>;
}) {
  const { orderId, transactionId } = await searchParams;
  if (!orderId) redirect("/checkout");

  const pending = await read<Pending | null>(`pending_sq_${orderId}`, null);
  if (!pending) {
    return <Message title="Session introuvable" body="Nous n'avons pas retrouvé votre paiement. Si vous avez été débité, contactez-nous." />;
  }
  if (pending.done && pending.orderId) redirect(`/order/${pending.orderId}`);

  const cfg = await getGatewayConfig("square");
  if (!cfg?.credentials.accessToken) {
    return <Message title="Configuration manquante" body="Le paiement n'a pas pu être vérifié." />;
  }

  // Vérifie l'état de la commande côté Square.
  const apiBase =
    cfg.mode === "live"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  let paid = !!transactionId;
  try {
    const res = await fetch(`${apiBase}/v2/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${cfg.credentials.accessToken}`,
        "Square-Version": "2024-12-18",
      },
      cache: "no-store",
    });
    const data = await res.json();
    const state = data.order?.state;
    if (state === "COMPLETED" || (data.order?.tenders?.length ?? 0) > 0) paid = true;
  } catch {
    /* on retombe sur la présence de transactionId */
  }

  if (!paid) {
    return <Message title="Paiement en attente" body="Votre paiement n'a pas encore été confirmé. Vous recevrez un e-mail dès validation." />;
  }

  const res = await createOrderOnce(
    `sq_${orderId}`,
    `pending_sq_${orderId}`,
    async () => {
      const { id } = await createOrder({
        customer: pending.draft.customer,
        email: pending.draft.email,
        address: pending.draft.address,
        items: pending.draft.items,
        total: pending.draft.total,
        psp: "Square",
      });
      await write(`pending_sq_${orderId}`, { ...pending, done: true, orderId: id });
      return id;
    },
  );
  if (!res.orderId) {
    return <Message title="Paiement en cours de validation" body="Votre commande sera confirmée par e-mail dans quelques instants." />;
  }
  redirect(`/order/${res.orderId}`);
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
      <h1 className="font-heading text-3xl">{title}</h1>
      <p className="mt-3 text-muted">{body}</p>
      <Link href="/products" className="mt-6 inline-block rounded-full bg-ink px-8 py-3.5 text-sm font-medium text-bg hover:bg-primary-dark">
        Retour à la boutique
      </Link>
    </div>
  );
}
