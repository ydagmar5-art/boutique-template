import "server-only";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ACHAT ENVOYÉ À GOOGLE ANALYTICS PAR LE SERVEUR                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. L'achat partait UNIQUEMENT depuis la page
 * de confirmation, dans le navigateur de la cliente. Or les deux ventes
 * d'une boutique (les 16 et 20/09/2026) n'ont jamais atteint
 * cette page : le module de paiement n'y a pas ramené la cliente. Résultat,
 * deux ventes venues de la publicité, invisibles pour Google Analytics donc
 * pour Google Ads, et un algorithme Shopping qui n'apprend rien.
 *
 * Ici, l'achat part du SERVEUR, au moment où la commande est créée. Il part
 * donc même si la cliente ferme son onglet, même si le module de paiement
 * plante, même si un bloqueur de publicité tourne.
 *
 * ⚠️ `clientId` EST LA CLÉ DE L'ATTRIBUTION. C'est l'identifiant du cookie
 * `_ga` de la visiteuse, relevé dans le tunnel. Sans lui, Google range la
 * vente dans une visite anonyme, sans lien avec le clic publicitaire — la
 * conversion existe, mais Google Ads ne sait pas quelle annonce l'a produite.
 *
 * ⚠️ NE LÈVE JAMAIS. Une commande encaissée ne doit pas échouer parce qu'une
 * statistique n'est pas partie.
 */

/** Mesure relevée dans le navigateur au moment du paiement. */
export interface MesureClient {
  /** Cookie `_ga` : « GA1.1.123456789.1699999999 » → « 123456789.1699999999 ». */
  clientId?: string;
  /** Identifiant de session, tiré du cookie `_ga_<flux>`. */
  sessionId?: string;
  /**
   * La visiteuse n'a PAS accepté la mesure d'audience (refus, ou bandeau
   * laissé sans réponse). ⚠️ L'achat ne part alors PAS chez Google : l'envoi
   * serveur ne doit jamais servir à contourner un refus de consentement
   * (art. 82 loi Informatique et Libertés, lignes directrices CNIL).
   */
  refus?: boolean;
}

export interface AchatGA4 {
  orderId: string;
  /** Montant en euros. */
  value: number;
  currency: string;
  items: { id: string; name: string; price: number; quantity: number; category?: string }[];
  mesure?: MesureClient;
}

/** Le suivi serveur n'est actif que si les deux réglages sont présents. */
/**
 * ⚠️ PRODUCTION SEULEMENT. Le script d'activation écrit la clé dans
 * `.env.local` : sans ce garde-fou, une commande de test passée sur un
 * serveur local (branché sur la vraie base) enverrait une VRAIE vente à
 * Google — c'est exactement l'incident qui avait faussé le CA du 20/09 côté
 * navigateur. Même règle que `components/site/PixelScripts.tsx`.
 */
function enProduction(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

export function suiviServeurActif(): boolean {
  return enProduction() && !!(process.env.GA_MEASUREMENT_ID && process.env.GA_API_SECRET);
}

export async function envoyerAchatGA4(achat: AchatGA4): Promise<boolean> {
  const id = process.env.GA_MEASUREMENT_ID;
  const secret = process.env.GA_API_SECRET;
  if (!suiviServeurActif() || !id || !secret) return false;
  if (achat.mesure?.refus) return false;

  /*
    Sans `clientId`, le protocole de mesure exige quand même un identifiant.
    On en fabrique un STABLE À PARTIR DU NUMÉRO DE COMMANDE : la vente est
    alors comptée, mais rattachée à une visiteuse inconnue. C'est le dernier
    recours — mieux vaut une vente mal attribuée qu'une vente perdue.
  */
  const clientId =
    achat.mesure?.clientId ||
    `${Math.abs(hachage(achat.orderId)) % 1_000_000_000}.${Math.floor(Date.now() / 1000)}`;

  const corps = {
    client_id: clientId,
    /* Horodatage en microsecondes : l'événement est daté de MAINTENANT. */
    timestamp_micros: Date.now() * 1000,
    non_personalized_ads: false,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: achat.orderId,
          value: achat.value,
          currency: achat.currency,
          ...(achat.mesure?.sessionId ? { session_id: achat.mesure.sessionId } : {}),
          /* Exigé par Google pour que la session compte comme engagée. */
          engagement_time_msec: 1,
          items: achat.items.map((it) => ({
            item_id: it.id,
            item_name: it.name,
            item_category: it.category,
            price: it.price,
            quantity: it.quantity,
          })),
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      },
    );
    if (!res.ok) {
      console.error("[ga4] refus", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    console.log(`[ga4] achat ${achat.orderId} envoyé (client ${clientId.slice(0, 12)}…)`);
    return true;
  } catch (e) {
    console.error("[ga4]", e);
    return false;
  }
}

/** Hachage court et stable, pour fabriquer un identifiant de repli. */
function hachage(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
