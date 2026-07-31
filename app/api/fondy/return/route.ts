import { NextResponse } from "next/server";
import { finalizeFondyPayment } from "@/lib/actions/checkout";

/**
 * Retour du client après un paiement Fondy (`response_url`).
 *
 * ⚠️ Fondy renvoie le navigateur ici en **POST** (formulaire auto-soumis) dans
 * le cas général, en GET dans certains cas — une page Next ne répondrait qu'au
 * GET, d'où ce route handler qui accepte les deux. Le corps envoyé par Fondy
 * n'est pas exploité : l'identifiant vient de notre propre paramètre `?o=` et
 * le statut est revérifié auprès de l'API Fondy (`finalizeFondyPayment`).
 */
async function handle(req: Request): Promise<Response> {
  const orderId = new URL(req.url).searchParams.get("o");
  const back = (msg: string) =>
    NextResponse.redirect(
      new URL(`/checkout?error=${encodeURIComponent(msg)}`, req.url),
      303,
    );

  if (!orderId) return back("Paiement introuvable.");

  const res = await finalizeFondyPayment(orderId);
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
