import { NextResponse } from "next/server";
import { finalizeMolliePayment } from "@/lib/actions/checkout";

/**
 * Retour du client après le 3-D Secure Mollie (`redirectUrl`).
 *
 * ⚠️ Mollie renvoie le client ICI dans TOUS les cas — payé, refusé, annulé —
 * et sans aucune information de statut. C'est `finalizeMolliePayment` qui
 * relit le paiement chez Mollie ; se fier à ce simple retour créerait des
 * commandes pour des paiements refusés.
 *
 * L'identifiant vient de notre propre paramètre `?o=` : la référence a été
 * placée dans l'URL à la création, avant que Mollie n'attribue son `tr_…`.
 */
async function handle(req: Request): Promise<Response> {
  const reference = new URL(req.url).searchParams.get("o");
  const back = (msg: string) =>
    NextResponse.redirect(
      new URL(`/checkout?error=${encodeURIComponent(msg)}`, req.url),
      303,
    );

  if (!reference) return back("Paiement introuvable.");

  const res = await finalizeMolliePayment(reference);
  if (res.orderId)
    return NextResponse.redirect(new URL(`/order/${res.orderId}`, req.url), 303);
  if (res.pending)
    return back(
      "Votre paiement est en cours de validation. Vous recevrez un e-mail dès qu'il sera confirmé.",
    );
  return back(res.error ?? "Le paiement a échoué.");
}

export const POST = handle;
export const GET = handle;
export const dynamic = "force-dynamic";
