import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { read, write, listByPrefix } from "@/lib/db/store";
import { createOrderOnce } from "@/lib/payments/finalize";
import { createOrder } from "@/lib/actions/orders";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import type { Order } from "@/lib/db/seed";

// Le webhook attend quelques secondes avant de créer une commande manquante.
export const maxDuration = 30;

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
      techniques se lisent dans le journal d'exécution de l'hébergement
      (`hostinger hosting nodejs runtime-logs <compte> <domaine> --period 1h`).

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
  const commandeConnue = (liste: Order[]) =>
    liste.some((c) => {
      if (c.pspRef === paiementId) return true;
      if (!emailMeta || (c.email ?? "").trim().toLowerCase() !== emailMeta) return false;
      // Une commande du même client, créée dans les six dernières heures.
      const t = Date.parse(c.date ?? "");
      return !Number.isFinite(t) || t >= recemment;
    });
  const dejaConnue = commandeConnue(await read<Order[]>(ORDERS, []));
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

  /*
    ╔════════════════════════════════════════════════════════════════╗
    ║  FILET DE SÉCURITÉ — le webhook CRÉE la commande manquante      ║
    ╚════════════════════════════════════════════════════════════════╝

    Incident réel : une cliente a été débitée sans qu'aucune
    commande soit enregistrée, ni confirmation envoyée. La commande n'était
    créée QUE par la page de la cliente après paiement (onCheckoutComplete →
    payWhop) : onglet fermé, redirection 3-D Secure, réseau coupé, et la vente
    était perdue en silence.

    Désormais, quand Whop confirme un paiement sans commande correspondante :
      1. on attend 6 s — dans le cas normal, la page de la cliente a fini
         d'enregistrer la commande entre-temps ;
      2. on revérifie (même e-mail, moins de 6 h) — sinon on ne fait rien ;
      3. on reprend le brouillon enregistré au démarrage du paiement
         (`pending_whop_*`, même e-mail, non payé, moins de 24 h) ;
      4. le MONTANT encaissé par Whop doit égaler le panier (±1 centime),
         sinon rien n'est créé — même garde-fou que payWhop ;
      5. création par `createOrder`, qui envoie la confirmation à la cliente,
         l'e-mail au gérant et la notification Telegram de commande.

    ⚠️ PAS d'alerte Telegram « encaissé sans commande » (décision du gérant) :
    les cas non rattrapés sont seulement journalisés.
  */
  /*
    ⚠️ ATTENTE RAMENÉE DE 6 s À 2 s (20/09/2026).

    Cette pause existe pour laisser la page de la cliente créer la commande
    elle-même dans le cas normal. Six secondes, c'était six secondes de plus
    devant un écran d'attente quand le rappel de Whop se perd — et il se perd.
    Deux secondes suffisent : le double n'est de toute façon pas possible,
    `createOrderOnce` pose un verrou sur l'identifiant de paiement.
  */
  await new Promise((r) => setTimeout(r, 2000));
  if (commandeConnue(await read<Order[]>(ORDERS, []))) {
    return NextResponse.json({ ok: true, deja: true });
  }

  const brutMontant = donnees.final_amount ?? donnees.total ?? donnees.subtotal ?? donnees.amount;
  const montantCents =
    typeof brutMontant === "number" ? Math.round(brutMontant * 100)
    : typeof brutMontant === "string" && brutMontant.trim() !== "" ? Math.round(parseFloat(brutMontant) * 100)
    : undefined;

  type Brouillon = { done?: boolean; at?: string; orderId?: string | null; draft?: CheckoutDraft };
  const limite = Date.now() - 24 * 60 * 60 * 1000;
  const candidats = (await listByPrefix<Brouillon>("pending_whop_"))
    .filter((b) => !b.value?.done && (b.value?.draft?.email ?? "").trim().toLowerCase() === emailMeta)
    .filter((b) => Date.parse(b.value?.at ?? b.updatedAt ?? "") >= limite)
    .sort((x, y) => (y.value?.at ?? "").localeCompare(x.value?.at ?? ""));
  const brouillon = candidats.find(
    (b) => typeof montantCents === "number" && Math.abs((b.value.draft?.total ?? -1) - montantCents) <= 1,
  );

  if (!brouillon?.value.draft) {
    console.warn(
      "[webhook whop] paiement sans commande ni brouillon correspondant :",
      paiementId,
      type,
      `montant ${montantCents ?? "inconnu"}`,
      `${candidats.length} brouillon(s) pour cet e-mail`,
    );
    return NextResponse.json({ ok: true, orpheline: true });
  }

  const draft = brouillon.value.draft;
  try {
    const { orderId } = await createOrderOnce(`whop_${paiementId}`, `whop_done_${paiementId}`, async () => {
      // Dernière vérification dans le verrou : la page a pu finir entre-temps.
      if (commandeConnue(await read<Order[]>(ORDERS, []))) return "deja";
      const { id } = await createOrder({
        customer: draft.customer,
        email: draft.email,
        address: draft.address,
        items: draft.items,
        total: draft.total,
        subtotal: draft.subtotal,
        discounts: draft.discounts,
        psp: "Whop",
        phone: draft.phone,
        pspRef: paiementId,
        source: draft.source,
      });
      return id;
    });
    if (orderId && orderId !== "deja") {
      await write(`whop_done_${paiementId}`, { done: true, orderId });
      await write(brouillon.key, { ...brouillon.value, done: true, orderId });
      console.info("[webhook whop] commande créée par le filet de sécurité :", orderId, paiementId);
      return NextResponse.json({ ok: true, commande: orderId });
    }
    return NextResponse.json({ ok: true, deja: true });
  } catch (e) {
    console.error("[webhook whop] création de la commande impossible :", paiementId, e);
    // 500 : Whop réessaiera plus tard.
    return NextResponse.json({ error: "création impossible" }, { status: 500 });
  }

}
