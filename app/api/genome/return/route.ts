import { NextResponse } from "next/server";
import { awaitGenomeOrder } from "@/lib/actions/checkout";

/**
 * Retour du client après un paiement Genome (`VALUE_SUCCESS_URL`).
 *
 * Ce retour ne prouve rien : c'est le callback serveur signé qui fait foi. On
 * attend donc quelques secondes que la commande apparaisse avant de basculer
 * sur un message d'attente — le client, lui, recevra l'e-mail de confirmation
 * dès que le callback sera traité.
 *
 * Accepte GET et POST : la méthode employée par la page hébergée n'est pas
 * garantie, et une page Next ne répondrait qu'au GET.
 */
async function handle(req: Request): Promise<Response> {
  const orderId = new URL(req.url).searchParams.get("o");
  if (!orderId) {
    return NextResponse.redirect(
      new URL(`/checkout?error=${encodeURIComponent("Paiement introuvable.")}`, req.url),
      303,
    );
  }

  const res = await awaitGenomeOrder(orderId);
  if (res.orderId) {
    return NextResponse.redirect(new URL(`/order/${res.orderId}`, req.url), 303);
  }
  return NextResponse.redirect(
    new URL(
      `/checkout?error=${encodeURIComponent(
        "Votre paiement est en cours de validation. Vous recevrez un e-mail dès qu'il sera confirmé.",
      )}`,
      req.url,
    ),
    303,
  );
}

export const POST = handle;
export const GET = handle;
export const dynamic = "force-dynamic";
