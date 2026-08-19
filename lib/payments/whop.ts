import "server-only";
import { WHOP_API_VERSION, WHOP_PRODUCT_ID } from "@/config/whop";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  WHOP — vérification serveur d'un paiement embarqué              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Le widget Whop encaisse dans son iframe puis appelle `onCheckoutComplete`
 * DANS LE NAVIGATEUR. Ce rappel n'est pas une preuve : n'importe qui peut
 * l'appeler depuis la console avec un identifiant inventé. Avant de créer une
 * commande payée, le serveur redemande donc le reçu à Whop avec la clé API.
 *
 * ⚠️ Whop a fait évoluer ses API (v2 puis v5) et la forme exacte du reçu
 * dépend du compte. On interroge donc plusieurs points d'entrée et on
 * n'accepte QUE si l'un d'eux confirme explicitement un paiement abouti.
 * En cas d'indisponibilité (réseau, 5xx), on ne bloque pas la vente — la
 * commande est créée mais signalée comme NON VÉRIFIÉE, pour que le gérant
 * confronte au tableau de bord Whop avant de livrer.
 */

const API = "https://api.whop.com";

export type VerdictWhop =
  | { etat: "paye"; montantCents?: number; devise?: string }
  | { etat: "refuse"; raison: string }
  | { etat: "indisponible"; raison: string };

/** États que Whop considère comme un encaissement abouti. */
const ETATS_OK = new Set(["paid", "succeeded", "completed", "success", "active"]);

async function lire(url: string, cle: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cle}`,
      Accept: "application/json",
      // Sans User-Agent explicite, certaines protections renvoient 1010.
      "User-Agent": "cheapsub-server",
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

function extraireStatut(body: unknown): { statut?: string; montant?: number; devise?: string } {
  if (!body || typeof body !== "object") return {};
  const o = body as Record<string, unknown>;
  // Certaines réponses enveloppent l'objet dans `data`.
  const n = (o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : o);
  const statut = String(n.status ?? n.state ?? n.payment_status ?? "").toLowerCase();
  // Whop exprime les montants en unités monétaires (float), pas en centimes.
  const brut = n.final_amount ?? n.amount ?? n.total ?? n.subtotal;
  const montant =
    typeof brut === "number" ? Math.round(brut * 100)
    : typeof brut === "string" && brut.trim() !== "" ? Math.round(parseFloat(brut) * 100)
    : undefined;
  const devise = typeof n.currency === "string" ? n.currency.toUpperCase() : undefined;
  return { statut: statut || undefined, montant, devise };
}

/**
 * Vérifie qu'un reçu Whop correspond bien à un paiement abouti.
 *
 * @param receiptId identifiant remonté par `onCheckoutComplete`
 * @param cle       clé API Whop (secrète, jamais côté navigateur)
 */
export async function verifierRecuWhop(receiptId: string, cle: string): Promise<VerdictWhop> {
  if (!receiptId.trim()) return { etat: "refuse", raison: "identifiant de reçu vide" };
  if (!cle.trim()) return { etat: "indisponible", raison: "clé API Whop absente" };

  /*
    Ordre choisi d'après le CLI officiel (`whop payments status <payment_id>`) :
    la ressource s'appelle « payments » et l'identifiant remonté par
    `onCheckoutComplete` est un identifiant de PAIEMENT. Les autres chemins
    restent en repli, Whop ayant fait cohabiter plusieurs versions d'API.
  */
  const pistes = [
    `${API}/api/v2/payments/${encodeURIComponent(receiptId)}`,
    `${API}/api/v5/company/payments/${encodeURIComponent(receiptId)}`,
    `${API}/api/v2/receipts/${encodeURIComponent(receiptId)}`,
  ];

  let dernierEchec = "aucune réponse exploitable";
  for (const url of pistes) {
    try {
      const r = await lire(url, cle);
      if (r.status === 404) { dernierEchec = "reçu introuvable (404)"; continue; }
      if (r.status === 401 || r.status === 403) {
        return { etat: "indisponible", raison: `clé API refusée (${r.status})` };
      }
      if (!r.ok) { dernierEchec = `HTTP ${r.status}`; continue; }

      const { statut, montant, devise } = extraireStatut(r.body);
      if (!statut) { dernierEchec = "statut absent de la réponse"; continue; }
      if (ETATS_OK.has(statut)) return { etat: "paye", montantCents: montant, devise };
      return { etat: "refuse", raison: `statut Whop « ${statut} »` };
    } catch (e) {
      dernierEchec = e instanceof Error ? e.message : String(e);
    }
  }
  // Aucune piste n'a confirmé : on ne DÉCLARE PAS le paiement refusé (ce
  // serait perdre une vente réelle sur une API qui a bougé), on remonte
  // l'incertitude à l'appelant qui décidera quoi en faire.
  return { etat: "indisponible", raison: dernierEchec };
}


/**
 * Crée une configuration de checkout portant un montant ARBITRAIRE.
 *
 * C'est ce qui libère la boutique du « un plan Whop par offre » : le plan est
 * créé à la volée au prix exact du panier, remises comprises. Rien à tenir en
 * double, rien à recréer quand un prix change.
 *
 * ⚠️ `initial_price` s'exprime en UNITÉS monétaires (1.23 pour 1,23 €), pas en
 * centimes. Se tromper d'unité facturerait cent fois trop.
 *
 * ⚠️ Sans clé API valide, plus aucun paiement ne peut démarrer — alors qu'en
 * plan fixe une clé cassée ne dégradait que la vérification. C'est le prix du
 * prix dynamique, et l'appelant doit traiter l'échec comme bloquant.
 */
export async function creerSessionWhop(
  totalCents: number,
  cle: string,
  metadonnees: Record<string, string>,
  /** Produit parapluie ; saisi dans /admin, sinon la constante de config. */
  produitId?: string,
): Promise<{ planId: string; sessionId: string } | { erreur: string }> {
  const produit = (produitId || WHOP_PRODUCT_ID).trim();
  if (!cle.trim()) return { erreur: "Clé API Whop manquante (back-office)." };
  if (!produit) return { erreur: "Produit Whop non renseigné (back-office)." };
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return { erreur: "Montant invalide." };
  }
  try {
    const res = await fetch(`${API}/api/v1/checkout_configurations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
        "Api-Version-Date": WHOP_API_VERSION,
        "User-Agent": "cheapsub-server",
      },
      body: JSON.stringify({
        mode: "payment",
        metadata: metadonnees,
        /**
         * Le paiement en cryptomonnaie est retiré du widget.
         *
         * Whop l'affiche par défaut (« Pay with Crypto »). Il n'a rien à faire
         * devant une cliente de maroquinerie : au mieux il ne sert jamais, au
         * pire il fait douter au moment de payer.
         *
         * ⚠️ Les DEUX tableaux sont obligatoires — l'API refuse la requête avec
         * le seul `disabled` (« must be an object with enabled and disabled
         * arrays »). `include_platform_defaults` garde tous les autres moyens.
         *
         * ⚠️ L'API ne valide PAS le contenu de `disabled` : elle accepte
         * n'importe quelle chaîne et la renvoie telle quelle. Une faute de
         * frappe passerait donc inaperçue. Identifiant vérifié sur un checkout
         * réel : « crypto » fait disparaître l'option, la carte reste en place.
         */
        payment_method_configuration: {
          enabled: [],
          disabled: ["crypto"],
          include_platform_defaults: true,
        },
        plan: {
          product_id: produit,
          plan_type: "one_time",
          currency: "eur",
          initial_price: Number((totalCents / 100).toFixed(2)),
          // Un plan par commande : sans ça Whop réutiliserait un plan existant
          // de même prix, et les métadonnées de la commande seraient mêlées.
          force_create_new_plan: true,
          visibility: "quick_link",
          metadata: metadonnees,
        },
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const corps = (await res.json().catch(() => null)) as
      | { id?: string; plan?: { id?: string }; message?: string; error?: string }
      | null;
    if (!res.ok || !corps?.id || !corps.plan?.id) {
      return {
        erreur:
          corps?.message ?? corps?.error ?? `Whop a refusé la création (HTTP ${res.status}).`,
      };
    }
    return { planId: corps.plan.id, sessionId: corps.id };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Whop injoignable." };
  }
}
