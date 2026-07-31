import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { createOrder } from "@/lib/actions/orders";
import { createOrderOnce } from "@/lib/payments/finalize";
import { finalizeStripePayment } from "@/lib/actions/checkout";
import { sendPaymentRefused } from "@/lib/emails";
import { read, write } from "@/lib/db/store";
import type { CheckoutDraft } from "@/lib/actions/checkout";

export const dynamic = "force-dynamic";

interface Pending {
  draft: CheckoutDraft;
  done: boolean;
  orderId: string | null;
}

/**
 * Webhook Stripe : reçoit les événements de paiement (succès / échec) et
 * déclenche création de commande + e-mails, même si le client ferme l'onglet.
 * À configurer dans Stripe → Developers → Webhooks (URL : /api/webhooks/stripe),
 * puis coller le "Signing secret" (whsec_…) dans le back-office (champ webhook Stripe).
 */
export async function POST(req: Request) {
  const cfg = await getGatewayConfig("stripe");
  const secretKey = cfg?.credentials.secretKey;
  const webhookSecret = cfg?.credentials.webhookSecret;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 400 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    return NextResponse.json(
      { error: `Signature invalide : ${e instanceof Error ? e.message : ""}` },
      { status: 400 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      // Filet de sécurité : crée la commande si la page de retour ne l'a pas fait.
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        const pending = await read<Pending | null>(`pending_${session.id}`, null);
        if (pending && !pending.done) {
          await createOrderOnce(
            `st_${session.id}`,
            `pending_${session.id}`,
            async () => {
              const { id } = await createOrder({
                customer: pending.draft.customer,
                email: pending.draft.email,
                address: pending.draft.address,
                items: pending.draft.items,
                total: pending.draft.total,
                psp: "Stripe",
              });
              await write(`pending_${session.id}`, { ...pending, done: true, orderId: id });
              return id;
            },
          );
        }
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const pending = await read<Pending | null>(`pending_${session.id}`, null);
      if (pending && !pending.done) {
        await sendPaymentRefused(pending.draft.email, pending.draft.customer);
      }
    } else if (event.type === "payment_intent.succeeded") {
      // Payment Element : filet de sécurité si le client ferme l'onglet avant
      // que la page ait eu le temps de créer la commande.
      // ⚠️ Passe par `finalizeStripePayment` (et son verrou) plutôt que de
      // recréer la commande ici : ce webhook arrive souvent EN MÊME TEMPS que
      // le retour navigateur, et deux créations concurrentes font deux commandes.
      const intent = event.data.object as Stripe.PaymentIntent;
      await finalizeStripePayment(intent.id);
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const pending = await read<Pending | null>(`pending_${intent.id}`, null);
      if (pending && !pending.done) {
        await sendPaymentRefused(pending.draft.email, pending.draft.customer);
      }
    }
  } catch (e) {
    console.error("[stripe webhook]", e);
  }

  return NextResponse.json({ received: true });
}
