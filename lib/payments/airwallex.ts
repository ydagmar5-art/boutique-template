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
