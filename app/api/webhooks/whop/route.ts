import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { read } from "@/lib/db/store";
import { sendTelegramAlert } from "@/lib/telegram";
import type { Order } from "@/lib/db/seed";

/** Même clé que `lib/actions/orders.ts` (constante locale là-bas). */
const ORDERS = "orders";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  WEBHOOK WHOP — FILET DE SÉCURITÉ, PAS CHEMIN PRINCIPAL          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Le checkout embarqué crée déjà la commande de façon synchrone
 * (`payWhop`). Ce webhook ne la refait donc PAS : il n'en a pas les moyens,
 * un événement de paiement ne porte ni le panier, ni l'identité saisie au
 * tunnel. Reconstruire une commande à partir de ça produirait des lignes
 * fausses.
 *
 * Son rôle : détecter le cas de bord où Whop a encaissé mais où aucune
 * commande n'existe — client qui ferme l'onglet pile après le paiement,
 * navigateur qui plante. Le gérant est alors alerté sur Telegram pour
 * régulariser à la main.
 *
 * ⚠️ La signature DOIT être vérifiée : sans elle, n'importe qui peut poster
 * ici et déclencher des alertes, voire faire croire à des ventes.
 */

export const runtime = "nodejs";
// Le corps BRUT est nécessaire au calcul de la signature : toute
// re-sérialisation (JSON.parse puis stringify) changerait les octets signés.
export const dynamic = "force-dynamic";

/**
 * Whop signe selon la norme **Standard Webhooks** (implémentation Svix) —
 * constaté sur les en-têtes réellement reçus : `webhook-id`,
 * `webhook-timestamp`, `webhook-signature`.
 *
 *   chaîne signée : `{webhook-id}.{webhook-timestamp}.{corps brut}`
 *   algorithme    : HMAC-SHA256
 *   secret        : `whsec_<base64>` → il faut DÉCODER la partie base64,
 *                   signer avec les octets, pas avec la chaîne
 *   signature     : en BASE64, et l'en-tête peut en contenir plusieurs,
 *                   séparées par des espaces, chacune préfixée `v1,`
 *
 * Se tromper sur l'un de ces quatre points fait échouer la vérification sans
 * rien dire de plus qu'« invalide » — d'où le détail ici.
 */
const TOLERANCE_HORODATAGE_S = 300;

function comparer(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function signatureValide(
  brut: string,
  entetes: { id: string; horodatage: string; signature: string },
  secretBrut: string,
): boolean {
  const { id, horodatage, signature } = entetes;
  if (!id || !horodatage || !signature) return false;

  /*
    Rejeu : un message signé reste valide indéfiniment si on ne borne pas son
    âge. Cinq minutes, c'est la tolérance retenue par la norme.
  */
  const age = Math.abs(Date.now() / 1000 - Number(horodatage));
  if (!Number.isFinite(age) || age > TOLERANCE_HORODATAGE_S) return false;

  /*
    ⚠️ Whop délivre ses secrets sous plusieurs formes selon l'endroit où on
    les crée : `whsec_<base64>` (norme Standard Webhooks) mais aussi `ws_…`
    depuis le tableau de bord. Impossible de savoir a priori si les octets à
    utiliser sont la chaîne elle-même ou sa partie décodée en base64.

    Se tromper ne produit AUCUN signe visible : la signature ne correspond
    pas, la route répond 401, et Whop range l'échec dans un journal que
    personne ne lit. Les paiements orphelins ne seraient jamais signalés.

    On essaie donc les interprétations plausibles et on accepte si l'une
    correspond. Ça n'affaiblit rien : il faut toujours connaître le secret.
  */
  const sansPrefixe = secretBrut.replace(/^(whsec_|ws_)/, "");
  const cles: Buffer[] = [Buffer.from(secretBrut, "utf8")];
  if (sansPrefixe !== secretBrut) {
    cles.push(Buffer.from(sansPrefixe, "utf8"));
    const decode = Buffer.from(sansPrefixe, "base64");
    if (decode.length > 0) cles.push(decode);
  }

  const recues = signature
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("v1,") ? p.slice(3) : p));

  return cles.some((cle) => {
    const attendue = createHmac("sha256", cle)
      .update(`${id}.${horodatage}.${brut}`)
      .digest("base64");
    // « v1,<sig> v1,<autre> » — on accepte si l'une correspond.
    return recues.some((r) => comparer(r, attendue));
  });
}

export async function POST(req: Request) {
  const brut = await req.text();
  const cfg = await getGatewayConfig("whop");
  const secret = cfg?.credentials.webhookSecret?.trim();

  if (!secret) {
    // Sans secret configuré on ne peut rien authentifier : on refuse plutôt
    // que de traiter un message dont l'origine est inconnue.
    return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });
  }

  const entetes = {
    id: req.headers.get("webhook-id") ?? "",
    horodatage: req.headers.get("webhook-timestamp") ?? "",
    signature: req.headers.get("webhook-signature") ?? "",
  };
  if (!signatureValide(brut, entetes, secret)) {
    /*
      ⚠️ DIAGNOSTIC EN JOURNAL, JAMAIS SUR TELEGRAM.

      Cette alerte partait auparavant sur Telegram. Erreur de conception : le
      canal Telegram du gérant sert à savoir qu'une VENTE est tombée pendant
      son absence, pas à surveiller la santé du site. Et comme Whop réessaie un
      webhook refusé, une seule vente produisait une rafale de messages
      d'erreur au milieu des notifications de commande — le bruit finit par
      faire ignorer le signal.

      ⚠️ NE JAMAIS REBRANCHER `sendTelegramAlert` ICI. Les incidents
      techniques se lisent dans les journaux Vercel.

      On journalise les NOMS d'en-têtes reçus, jamais leurs valeurs : la
      signature est un secret. C'est ce qui permet d'identifier l'en-tête
      réellement employé par Whop sans le deviner.
    */
    console.warn(
      "[webhook whop] signature refusée · en-têtes reçus :",
      JSON.stringify([...req.headers.keys()]),
    );
    return NextResponse.json({ error: "signature invalide" }, { status: 401 });
  }

  let evenement: { action?: string; type?: string; data?: Record<string, unknown> };
  try {
    evenement = JSON.parse(brut);
  } catch {
    return NextResponse.json({ error: "corps illisible" }, { status: 400 });
  }

  const type = String(evenement.action ?? evenement.type ?? "");
  if (!/payment.*(succeed|paid)|invoice.*paid/i.test(type)) {
    // Événement non pertinent : on acquitte pour que Whop cesse de réessayer.
    return NextResponse.json({ ok: true, ignore: type });
  }

  const donnees = evenement.data ?? {};
  const paiementId = String(donnees.id ?? donnees.payment_id ?? "");
  if (!paiementId) return NextResponse.json({ ok: true, ignore: "sans identifiant" });

  /*
    ⚠️ Comparer `pspRef` à cet identifiant NE SUFFIT PAS : le tunnel enregistre
    le RECU remonté par onCheckoutComplete, alors que le webhook porte un
    identifiant de PAIEMENT (`pay_…`). Deux identifiants différents pour un
    même encaissement — d'où de fausses alertes « encaissé sans commande » à
    chaque vente réussie.

    On rapproche donc aussi par les métadonnées que la boutique a inscrites
    dans la session de paiement (e-mail du client), sur une fenêtre récente.
  */
  const meta = (donnees.metadata ?? {}) as Record<string, unknown>;
  const emailMeta = String(meta.email ?? donnees.user_email ?? donnees.email ?? "")
    .trim()
    .toLowerCase();

  const commandes = await read<Order[]>(ORDERS, []);
  const recemment = Date.now() - 6 * 60 * 60 * 1000;
  const dejaConnue = commandes.some((c) => {
    if (c.pspRef === paiementId) return true;
    if (!emailMeta || (c.email ?? "").trim().toLowerCase() !== emailMeta) return false;
    // Une commande du même client, créée dans les six dernières heures.
    const t = Date.parse(c.date ?? "");
    return !Number.isFinite(t) || t >= recemment;
  });
  if (dejaConnue) {
    return NextResponse.json({ ok: true, deja: true });
  }

  /*
    ⚠️ SANS CLÉ DE RAPPROCHEMENT, ON N'ALERTE PAS.

    L'e-mail est la seule donnée qui relie un paiement Whop à une commande —
    l'identifiant reçu ici n'est pas celui stocké dans `pspRef`. S'il manque,
    aucune conclusion n'est possible : dire « encaissé sans commande » serait
    faux à chaque vente, et une alerte qui crie à tort finit par être ignorée
    le jour où elle a raison.

    Cas concernés : un paiement né hors de la boutique (lien Whop, terminal),
    ou une session d'avant la correction. On journalise, sans réveiller
    personne.
  */
  if (!emailMeta) {
    console.warn(
      "[webhook whop] paiement sans e-mail en métadonnée, rapprochement impossible :",
      paiementId,
    );
    return NextResponse.json({ ok: true, ignore: "sans clé de rapprochement" });
  }

  await sendTelegramAlert(
    `⚠️ Whop a encaissé SANS commande enregistrée — paiement ${paiementId} (${type}). ` +
      "Aucune commande ne le référence : vérifiez dans Whop et créez la commande à la main avant de livrer.",
  ).catch(() => {});

  return NextResponse.json({ ok: true, orpheline: true });
}
