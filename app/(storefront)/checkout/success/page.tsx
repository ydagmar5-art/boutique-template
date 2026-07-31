import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { createOrder } from "@/lib/actions/orders";
import { createOrderOnce } from "@/lib/payments/finalize";
import { read, write } from "@/lib/db/store";
import { finalizeStripePayment, type CheckoutDraft } from "@/lib/actions/checkout";

export const dynamic = "force-dynamic";

interface Pending {
  draft: CheckoutDraft;
  done: boolean;
  orderId: string | null;
}

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ sid?: string; payment_intent?: string }>;
}) {
  const { sid, payment_intent: paymentIntent } = await searchParams;

  // Retour d'une authentification 3-D Secure (Payment Element) : Stripe renvoie
  // le client ici avec l'identifiant du PaymentIntent.
  if (paymentIntent) {
    const res = await finalizeStripePayment(paymentIntent);
    if (res.orderId) redirect(`/order/${res.orderId}`);
    return (
      <Message
        title="Paiement non confirmé"
        body={res.error ?? "Si vous avez été débité, contactez-nous."}
      />
    );
  }

  // Ancien flux Checkout hébergé (sessions encore en cours au moment du
  // basculement vers le Payment Element).
  if (!sid) redirect("/checkout");

  const pending = await read<Pending | null>(`pending_${sid}`, null);
  if (!pending) {
    return <Message title="Session introuvable" body="Nous n'avons pas retrouvé votre paiement. Si vous avez été débité, contactez-nous." />;
  }
  // Déjà traité → on renvoie vers la commande existante.
  if (pending.done && pending.orderId) redirect(`/order/${pending.orderId}`);

  const cfg = await getGatewayConfig("stripe");
  if (!cfg?.credentials.secretKey) {
    return <Message title="Configuration manquante" body="Le paiement n'a pas pu être vérifié." />;
  }

  const stripe = new Stripe(cfg.credentials.secretKey);
  const session = await stripe.checkout.sessions.retrieve(sid);

  if (session.payment_status !== "paid") {
    return (
      <Message
        title="Paiement en attente"
        body="Votre paiement n'a pas encore été confirmé. Vous recevrez un e-mail dès validation."
      />
    );
  }

  // Paiement confirmé → création de la commande, verrouillée pour que le
  // webhook `checkout.session.completed` n'en crée pas une seconde.
  const res = await createOrderOnce(`st_${sid}`, `pending_${sid}`, async () => {
    const { id } = await createOrder({
      customer: pending.draft.customer,
      email: pending.draft.email,
      address: pending.draft.address,
      items: pending.draft.items,
      total: pending.draft.total,
      psp: "Stripe",
    });
    await write(`pending_${sid}`, { ...pending, done: true, orderId: id });
    return id;
  });
  if (!res.orderId) {
    return (
      <Message
        title="Paiement en cours de validation"
        body="Votre commande sera confirmée par e-mail dans quelques instants."
      />
    );
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
