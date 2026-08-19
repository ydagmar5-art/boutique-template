import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { airwallexVerifyWebhook } from "@/lib/payments/airwallex";
import { finalizeAirwallexFromWebhook } from "@/lib/actions/checkout";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Webhook Airwallex — filet de sécurité du paiement embarqué.
 *
 * À déclarer dans le tableau de bord Airwallex (Developer → Webhooks) :
 *     https://<votre-domaine>/api/webhooks/airwallex
 *
 * ⚠️ CE N'EST PAS le chemin principal. En marche normale, c'est le navigateur
 * qui annonce le succès et déclenche l'enregistrement de la commande. Ce
 * webhook ne sert QUE lorsque ce retour n'a pas lieu : onglet fermé juste après
 * le paiement, réseau coupé, 3-D Secure qui rend la main sur une page morte.
 * Sans lui, l'argent est encaissé et rien n'est enregistré — ni commande, ni
 * e-mail de confirmation, ni ligne dans le tableau de bord.
 *
 * Les deux chemins peuvent se croiser sans provoquer de doublon : la création
 * passe par `createOrderOnce`, qui rend la commande existante au lieu d'en
 * ouvrir une seconde.
 */

/** Seul événement qui vaut encaissement. Les autres sont accusés sans effet. */
const EVENEMENT_SUCCES = "payment_intent.succeeded";

/**
 * Fenêtre d'acceptation de l'horodatage.
 *
 * La signature couvre `timestamp + corps` : sans contrôle de fraîcheur, une
 * requête légitime interceptée resterait rejouable indéfiniment. Cinq minutes
 * laissent de la marge aux réémissions d'Airwallex sans ouvrir cette porte.
 */
const TOLERANCE_MS = 5 * 60 * 1000;

export async function POST(req: Request): Promise<Response> {
  const cfg = await getGatewayConfig("airwallex");
  const secret = cfg?.credentials?.webhookSecret?.trim();
  if (!cfg?.enabled || !secret) {
    // 400 et non 200 : tant que le secret n'est pas renseigné, rien ne peut
    // être vérifié. Mieux vaut qu'Airwallex signale l'échec dans son journal
    // plutôt que de laisser croire que les paiements sont rattrapés.
    return NextResponse.json({ error: "Airwallex non configuré" }, { status: 400 });
  }

  // Corps BRUT : la signature porte sur les octets reçus. Le re-sérialiser
  // suffirait à la faire échouer.
  const raw = await req.text();
  const signature = req.headers.get("x-signature");
  const timestamp = req.headers.get("x-timestamp");

  if (!airwallexVerifyWebhook(secret, raw, signature, timestamp)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_MS) {
    return NextResponse.json({ error: "Horodatage hors fenêtre" }, { status: 401 });
  }

  let event: { name?: string; data?: { object?: { id?: string; status?: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  if (event.name !== EVENEMENT_SUCCES) {
    return NextResponse.json({ received: true, ignored: event.name ?? null });
  }

  const intentId = event.data?.object?.id;
  if (!intentId) return NextResponse.json({ received: true });

  try {
    const res = await finalizeAirwallexFromWebhook(intentId);

    if (res.error) {
      // Un encaissement qu'on ne sait pas rattacher à une cliente ne doit pas
      // rester dans un journal que personne ne lit : il faut expédier, et
      // seul un humain peut retrouver le destinataire chez Airwallex.
      console.error("[webhook airwallex]", intentId, res.error);
      await sendTelegramAlert(
        `⚠️ Paiement Airwallex encaissé mais NON enregistré\n` +
          `Intent : ${intentId}\n` +
          `Motif : ${res.error}\n` +
          `À traiter à la main depuis le tableau de bord Airwallex.`,
      ).catch(() => {});
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook airwallex]", intentId, e);
    // 200 malgré l'échec : un code d'erreur relance Airwallex en boucle pendant
    // des heures. L'idempotence de `createOrderOnce` rend la réémission sûre,
    // mais elle n'a d'intérêt que si l'échec est transitoire.
    return NextResponse.json({ received: true });
  }
}
