import "server-only";

/**
 * Client Mollie (https://www.mollie.com) — Components + API v2.
 *
 * ─── Pourquoi Mollie peut figurer au registre des PSP EMBARQUÉS ───────────
 * Les champs carte sont des IFRAMES servies par Mollie (`mollie.js`). Le
 * numéro de carte ne touche jamais nos serveurs : le navigateur échange la
 * saisie contre un `cardToken` chez Mollie, et c'est ce jeton — inutilisable
 * ailleurs — que nous transmettons à l'API. La boutique reste en PCI SAQ-A.
 *
 * ⚠️ Le 3-D Secure se fait par REDIRECTION, même avec les Components : la
 * création du paiement renvoie `_links.checkout`, et c'est Mollie qui héberge
 * l'authentification. Le tunnel traite donc Mollie comme Fondy — champs sur
 * place, puis `handled: true` pendant que Mollie prend la main.
 *
 * ⚠️ Les montants Mollie sont des CHAÎNES en unités MAJEURES à deux décimales
 * (« 78.40 »), alors que la boutique compte en centimes. `toMajorUnits` fait
 * la conversion : s'en écarter facturerait 100 fois le prix.
 *
 * server-only : la clé API encaisse, elle ne doit jamais partir au navigateur.
 */

const API = "https://api.mollie.com/v2";

export interface MollieCreds {
  apiKey: string;
  profileId: string;
}

/**
 * Extrait et valide les identifiants saisis dans le back-office.
 *
 * ⚠️ La clé API porte son environnement dans son préfixe (`test_` ou `live_`) :
 * Mollie n'a pas d'URL de sandbox distincte. Une clé `test_` enregistrée dans
 * l'onglet « live » encaisserait donc dans le vide, sans erreur visible.
 */
export function mollieCreds(
  credentials: Record<string, string> | undefined,
): MollieCreds | null {
  const apiKey = credentials?.apiKey?.trim();
  const profileId = credentials?.profileId?.trim();
  if (!apiKey || !profileId) return null;
  return { apiKey, profileId };
}

/** true si la clé est une clé de test — sert à régler `testmode` côté navigateur. */
export const isMollieTestKey = (apiKey: string) => apiKey.startsWith("test_");

/** Centimes → chaîne décimale attendue par Mollie (« 7840 » → « 78.40 »). */
export const toMajorUnits = (cents: number): string => (cents / 100).toFixed(2);

async function call<T>(
  creds: MollieCreds,
  path: string,
  init?: RequestInit,
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => null)) as
      | (T & { detail?: string; title?: string })
      | null;
    if (!res.ok) {
      console.error("[mollie]", res.status, body);
      return { error: body?.detail ?? "Mollie a refusé la requête." };
    }
    if (!body) return { error: "Réponse Mollie illisible." };
    return { data: body };
  } catch (e) {
    console.error("[mollie]", e);
    return { error: "Mollie est injoignable." };
  }
}

/** Statuts renvoyés par l'API. Seul `paid` vaut encaissement. */
export type MollieStatus =
  | "open"
  | "pending"
  | "authorized"
  | "paid"
  | "canceled"
  | "expired"
  | "failed";

export interface MolliePayment {
  id: string;
  status: MollieStatus;
  amount: { value: string; currency: string };
  _links?: { checkout?: { href: string } };
  details?: { failureMessage?: string };
}

export interface MollieCreateInput {
  /** Jeton produit par `mollie.createToken()` dans le navigateur. */
  cardToken: string;
  /** Montant en CENTIMES. */
  amount: number;
  currency: string;
  description: string;
  /** Retour du navigateur après le 3-D Secure. */
  redirectUrl: string;
  /** Notification serveur — seule source fiable du statut final. */
  webhookUrl: string;
  /** Identifiant interne, replacé dans les métadonnées pour le rapprochement. */
  reference: string;
}

export async function mollieCreatePayment(
  creds: MollieCreds,
  input: MollieCreateInput,
): Promise<{ payment?: MolliePayment; error?: string }> {
  const { data, error } = await call<MolliePayment>(creds, "/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: {
        currency: input.currency,
        value: toMajorUnits(input.amount),
      },
      description: input.description,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      method: "creditcard",
      cardToken: input.cardToken,
      metadata: { reference: input.reference },
    }),
  });
  if (error || !data) return { error: error ?? "Mollie : paiement non créé." };
  return { payment: data };
}

/**
 * Relit le paiement chez Mollie.
 *
 * ⚠️ C'est la SEULE source de vérité. Le retour du navigateur ne porte aucune
 * information de statut — Mollie renvoie le client sur `redirectUrl` que le
 * paiement ait réussi, échoué ou été annulé. Se fier à ce retour créerait des
 * commandes pour des paiements refusés.
 */
export async function mollieGetPayment(
  creds: MollieCreds,
  paymentId: string,
): Promise<{ payment?: MolliePayment; error?: string }> {
  const { data, error } = await call<MolliePayment>(
    creds,
    `/payments/${encodeURIComponent(paymentId)}`,
  );
  if (error || !data) return { error: error ?? "Mollie : statut indisponible." };
  return { payment: data };
}
