import { NextResponse } from "next/server";
import {
  finalizeMolliePayment,
  mollieReferenceOf,
} from "@/lib/actions/checkout";

/**
 * Webhook Mollie.
 *
 * Mollie envoie un `POST` en `application/x-www-form-urlencoded` contenant le
 * seul champ `id` (`tr_…`). Aucune donnée de statut n'est transmise : c'est
 * volontaire de leur part, et cela nous oblige à relire le paiement — ce qui
 * est de toute façon la seule manière sûre de procéder.
 *
 * ⚠️ Mollie NE SIGNE PAS ses webhooks. La protection ne vient donc pas de la
 * requête mais de ce qu'on en fait : le corps n'apporte qu'un identifiant, le
 * statut et le montant sont relus chez Mollie avec notre clé API. Un tiers qui
 * appellerait cette URL avec un identifiant au hasard ne provoquerait rien.
 *
 * ⚠️ Toujours répondre 200, même en cas d'échec applicatif : un code d'erreur
 * déclenche des tentatives répétées de Mollie pendant des heures. Le vrai
 * filet de sécurité est l'idempotence de `createOrderOnce`.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.text();
    const paymentId = new URLSearchParams(body).get("id");
    if (!paymentId) return NextResponse.json({ ok: true });

    const reference = await mollieReferenceOf(paymentId);
    if (!reference) return NextResponse.json({ ok: true });

    await finalizeMolliePayment(reference);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook mollie]", e);
    return NextResponse.json({ ok: true });
  }
}

export const dynamic = "force-dynamic";
