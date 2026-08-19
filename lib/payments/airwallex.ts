import "server-only";
import crypto from "node:crypto";

/**
 * Client Airwallex (https://airwallex.com) — Payment Intents API.
 *
 * Intégration EMBARQUÉE : le serveur crée un PaymentIntent, le navigateur monte
 * le Drop-in Element d'Airwallex (champs hébergés par eux) et confirme le
 * paiement sur place. Aucune donnée carte ne touche nos serveurs (SAQ-A).
 *
 * server-only : la clé API et le jeton d'accès ne doivent jamais partir vers le
 * navigateur — seuls l'`id` et le `client_secret` de l'intent y vont, et ils ne
 * valent que pour ce paiement précis.
 */

export interface AirwallexCreds {
  clientId: string;
  apiKey: string;
}

export function airwallexCreds(
  credentials: Record<string, string> | undefined,
): AirwallexCreds | null {
  const clientId = credentials?.clientId?.trim();
  const apiKey = credentials?.apiKey?.trim();
  if (!clientId || !apiKey) return null;
  return { clientId, apiKey };
}

/** `demo` côté SDK navigateur = `sandbox` côté API serveur. */
export const airwallexApiBase = (live: boolean) =>
  live ? "https://api.airwallex.com" : "https://api.sandbox.airwallex.com";

/**
 * Jeton d'accès (valable ~30 min).
 *
 * Mis en cache par couple de clés : une authentification par paiement
 * doublerait inutilement la latence du checkout.
 */
const tokenCache = new Map<string, { token: string; expires: number }>();

async function accessToken(
  creds: AirwallexCreds,
  live: boolean,
): Promise<{ token?: string; error?: string }> {
  const key = `${live ? "live" : "test"}:${creds.clientId}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expires > Date.now()) return { token: cached.token };

  try {
    const res = await fetch(`${airwallexApiBase(live)}/api/v1/authentication/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": creds.clientId,
        "x-api-key": creds.apiKey,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
      return {
        error:
          data?.message ??
          `Airwallex : authentification refusée (${res.status}).`,
      };
    }
    // Marge de sécurité : on renouvelle 5 min avant l'expiration annoncée.
    tokenCache.set(key, {
      token: data.token,
      expires: Date.now() + 25 * 60 * 1000,
    });
    return { token: data.token };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Airwallex injoignable.",
    };
  }
}

/**
 * ⚠️ Airwallex compte en unités MAJEURES (`"amount": 100` = 100 EUR), alors que
 * la boutique compte en centimes. Sans cette conversion, un panier de 159 €
 * serait débité 15 900 €.
 */
const toMajorUnits = (cents: number) => Number((cents / 100).toFixed(2));

export interface AirwallexIntent {
  id: string;
  clientSecret: string;
  /** Montant en centimes, tel que renvoyé par Airwallex (reconverti). */
  amount: number;
  currency: string;
  status: string;
  /**
   * Coordonnées portées par l'intent.
   *
   * ⚠️ Indispensables pour Apple Pay : le bouton court-circuite le formulaire
   * du site, donc nom, adresse et e-mail ne viennent PAS de nos champs mais de
   * la fiche Apple, qu'Airwallex rattache à l'intent. Sans ça, un paiement
   * Apple Pay créerait une commande sans destinataire.
   */
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
}

/** Aplatit l'adresse Airwallex en une ligne, telle que la stocke la boutique. */
function adresseDe(shipping: Record<string, any> | undefined): string {
  const a = shipping?.address as Record<string, string> | undefined;
  if (!a) return "";
  return [a.street, a.postcode, a.city, a.country_code]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function contactDe(data: Record<string, any>): AirwallexIntent["contact"] {
  const shipping = data?.order?.shipping as Record<string, any> | undefined;
  const nom = [shipping?.first_name, shipping?.last_name]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    name: nom || undefined,
    email: data?.customer?.email || shipping?.email || undefined,
    phone: shipping?.phone_number || undefined,
    address: adresseDe(shipping) || undefined,
  };
}

/** Crée un PaymentIntent. `merchantOrderId` est notre référence interne. */
export async function airwallexCreateIntent(
  creds: AirwallexCreds,
  live: boolean,
  input: {
    amount: number;
    currency: string;
    merchantOrderId: string;
    email?: string;
    returnUrl?: string;
  },
): Promise<{ intent?: AirwallexIntent; error?: string }> {
  const { token, error } = await accessToken(creds, live);
  if (error || !token) return { error: error ?? "Airwallex : jeton indisponible." };

  try {
    const res = await fetch(
      `${airwallexApiBase(live)}/api/v1/pa/payment_intents/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          amount: toMajorUnits(input.amount),
          currency: input.currency,
          merchant_order_id: input.merchantOrderId,
          ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
          ...(input.email ? { customer: { email: input.email } } : {}),
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id || !data?.client_secret) {
      return {
        error: data?.message ?? `Airwallex : intent refusé (${res.status}).`,
      };
    }
    return {
      intent: {
        id: data.id,
        clientSecret: data.client_secret,
        amount: Math.round(Number(data.amount) * 100),
        currency: data.currency,
        status: data.status,
      },
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Airwallex injoignable.",
    };
  }
}

/**
 * Attache l'identité du destinataire à un PaymentIntent DÉJÀ CRÉÉ.
 *
 * ⚠️ Pourquoi un second appel plutôt qu'un champ à la création : le Card
 * Element d'Airwallex exige l'`id` et le `client_secret` de l'intent pour
 * s'afficher, donc l'intent naît au MONTAGE du formulaire — bien avant que la
 * cliente ait tapé son nom. L'API d'Airwallex prévoit exactement ce cas :
 * « update the existing PaymentIntent before the payment is confirmed ».
 *
 * ⚠️ NE JAMAIS FAIRE ÉCHOUER LE PAIEMENT ICI. Un refus (champ inattendu,
 * intent déjà confirmé, réseau) est journalisé et ignoré : la cliente paie,
 * simplement sans le bonus d'anti-fraude.
 */
export async function airwallexAttachIdentity(
  creds: AirwallexCreds,
  live: boolean,
  intentId: string,
  input: {
    shipping?: Record<string, unknown>;
    email?: string;
    metadata?: Record<string, string>;
  },
): Promise<{ ok: boolean }> {
  if (!input.shipping && !input.metadata) return { ok: false };
  const { token } = await accessToken(creds, live);
  if (!token) return { ok: false };

  try {
    const res = await fetch(
      `${airwallexApiBase(live)}/api/v1/pa/payment_intents/${encodeURIComponent(intentId)}/update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          ...(input.shipping ? { order: { shipping: input.shipping } } : {}),
          ...(input.email ? { customer: { email: input.email } } : {}),
          ...(input.metadata ? { metadata: input.metadata } : {}),
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("[airwallex] identité non attachée", res.status, detail);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[airwallex] identité non attachée", e);
    return { ok: false };
  }
}

/**
 * Relit un PaymentIntent côté serveur.
 *
 * ⚠️ C'est LA vérification qui compte : l'événement `success` du SDK vient du
 * navigateur du client, donc de quelqu'un qui peut le fabriquer. Rien n'est
 * encaissé tant qu'Airwallex n'a pas confirmé `SUCCEEDED` ici.
 */
export async function airwallexGetIntent(
  creds: AirwallexCreds,
  live: boolean,
  intentId: string,
): Promise<{ intent?: AirwallexIntent; error?: string }> {
  const { token, error } = await accessToken(creds, live);
  if (error || !token) return { error: error ?? "Airwallex : jeton indisponible." };

  try {
    const res = await fetch(
      `${airwallexApiBase(live)}/api/v1/pa/payment_intents/${encodeURIComponent(intentId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      return {
        error: data?.message ?? `Airwallex : paiement introuvable (${res.status}).`,
      };
    }
    return {
      intent: {
        id: data.id,
        clientSecret: data.client_secret ?? "",
        amount: Math.round(Number(data.amount) * 100),
        currency: data.currency,
        status: data.status,
        contact: contactDe(data),
      },
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Airwallex injoignable.",
    };
  }
}

/** Seul statut qui vaut encaissement. */
export const AIRWALLEX_SUCCESS = "SUCCEEDED";

/**
 * Vérifie la signature d'un webhook Airwallex.
 *
 * Airwallex signe `timestamp + corps brut` en HMAC-SHA256 avec le secret du
 * webhook, et transmet le résultat en hexadécimal dans `x-signature`, l'horodatage
 * dans `x-timestamp`.
 *
 * ⚠️ Le corps doit être celui REÇU, octet pour octet. Un `JSON.parse` suivi d'un
 * `JSON.stringify` réordonne les clés et change les espaces : la signature ne
 * correspondrait plus, et tous les paiements seraient rejetés.
 *
 * ⚠️ Comparaison à temps constant : un `===` sur des chaînes s'arrête au premier
 * octet différent, ce qui laisse deviner la signature attendue caractère par
 * caractère en mesurant le temps de réponse.
 */
export function airwallexVerifyWebhook(
  secret: string,
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  if (!secret || !signature || !timestamp) return false;

  const attendu = crypto
    .createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("hex");

  const a = Buffer.from(attendu, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  // `timingSafeEqual` exige des longueurs égales — la tester d'abord ne fuite
  // rien de plus que la longueur, déjà publique.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
