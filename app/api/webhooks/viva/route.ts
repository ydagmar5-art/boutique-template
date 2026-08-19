import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { vivaCreds, vivaWebhookKey } from "@/lib/payments/viva";
import { finalizeVivaFromWebhook } from "@/lib/actions/checkout";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Webhook Viva.com — filet de sécurité du paiement embarqué.
 *
 * À déclarer dans le back-office Viva (Settings → API Access → Webhooks) :
 *     https://<votre-domaine>/api/webhooks/viva
 *
 * ⚠️ CE N'EST PAS le chemin principal. En marche normale, c'est le navigateur
 * qui déclenche le débit et l'enregistrement. Ce webhook ne sert que lorsque ce
 * retour n'a pas lieu : onglet fermé après le 3-D Secure, réseau coupé, page
 * morte. Sans lui, l'argent serait encaissé sans qu'aucune commande n'existe.
 *
 * ⚠️ VIVA NE SIGNE PAS SES WEBHOOKS. Le corps reçu ne prouve donc rien, et
 * n'est jamais cru sur parole : il ne sert qu'à repérer QUELLE transaction
 * relire. Le statut et le montant sont ensuite relus chez Viva avec nos clés,
 * et c'est cette relecture seule qui autorise la création de la commande.
 */

/**
 * Vérification de propriété du domaine.
 *
 * À l'enregistrement de l'URL, Viva envoie un `GET` et attend `{ "Key": "…" }`.
 * La clé est délivrée par leur API, authentifiée avec nos identifiants : un
 * tiers ne peut donc pas faire passer son propre serveur pour le nôtre.
 *
 * ⚠️ Cette clé ne signe RIEN par la suite. Elle ne protège que cet
 * enregistrement — d'où la relecture systématique côté POST.
 */
export async function GET(): Promise<Response> {
  const cfg = await getGatewayConfig("viva");
  const creds = vivaCreds(cfg?.credentials);
  if (!cfg?.enabled || !creds) {
    return NextResponse.json({ error: "Viva non configuré" }, { status: 400 });
  }

  const { key, error } = await vivaWebhookKey(creds, cfg.mode === "live");
  if (error || !key) {
    return NextResponse.json(
      { error: error ?? "Clé indisponible" },
      { status: 502 },
    );
  }
  // Casse EXACTE attendue par Viva : `Key`, et non `key`.
  return NextResponse.json({ Key: key });
}

/** Transaction Payment Created — le seul événement qui vaut encaissement. */
const EVENEMENT_PAIEMENT = 1796;

export async function POST(req: Request): Promise<Response> {
  const cfg = await getGatewayConfig("viva");
  if (!cfg?.enabled || !vivaCreds(cfg.credentials)) {
    return NextResponse.json({ error: "Viva non configuré" }, { status: 400 });
  }

  let corps: {
    EventTypeId?: number;
    EventData?: {
      /** NOTRE référence, transmise au débit et renvoyée telle quelle. */
      MerchantTrns?: string;
      TransactionId?: string;
      StatusId?: string;
    };
  };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  if (corps.EventTypeId !== EVENEMENT_PAIEMENT) {
    return NextResponse.json({ received: true, ignored: corps.EventTypeId ?? null });
  }

  /* En Native Checkout v2 le débit ne crée aucun ordre : c'est `MerchantTrns`,
     notre propre référence, qui relie l'encaissement au panier. Un paiement
     né ailleurs (lien de paiement, terminal) n'en portera pas — il est alors
     accusé sans effet plutôt que de déclencher une recherche vouée à l'échec. */
  const ref = corps.EventData?.MerchantTrns;
  const transactionId = corps.EventData?.TransactionId;
  if (!ref || !transactionId) return NextResponse.json({ received: true });

  try {
    const res = await finalizeVivaFromWebhook({ ref, transactionId });

    if (res.error) {
      console.error("[webhook viva]", ref, res.error);
      await sendTelegramAlert(
        `⚠️ Paiement Viva encaissé mais NON enregistré\n` +
          `Référence : ${ref}\n` +
          `Transaction : ${transactionId}\n` +
          `Motif : ${res.error}\n` +
          `À traiter à la main depuis le back-office Viva.`,
      ).catch(() => {});
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook viva]", ref, e);
    // Toujours 200 : un code d'erreur relance Viva en boucle. La création est
    // idempotente, une réémission ne peut pas produire de doublon.
    return NextResponse.json({ received: true });
  }
}
