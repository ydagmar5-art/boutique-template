import "server-only";
import crypto from "node:crypto";
import { store } from "@/config/store.config";

/**
 * Client Fondy (https://fondy.eu) — API v1.0.
 *
 * server-only : le mot de passe marchand sert à signer chaque requête, il ne
 * doit JAMAIS partir vers le navigateur.
 */

const API = "https://pay.fondy.eu/api";

export interface FondyCreds {
  merchantId: string;
  password: string;
}

/** Extrait et valide les identifiants stockés dans le back-office. */
export function fondyCreds(
  credentials: Record<string, string> | undefined,
): FondyCreds | null {
  const merchantId = credentials?.merchantId?.trim();
  const password = credentials?.password?.trim();
  if (!merchantId || !password) return null;
  return { merchantId, password };
}

/**
 * Signature Fondy : SHA-1 du mot de passe suivi des valeurs des paramètres,
 * triées par NOM de paramètre (ordre alphabétique) et séparées par « | ».
 * Les champs vides, `signature` et `response_signature_string` sont exclus.
 *
 * Vérifié contre l'API réelle : SHA1("test|100|EUR|1396424|ping|ping-test-1")
 * = a8060adc4a1568d8ea5a1cca398ae60a41ec896d.
 */
export function fondySignature(
  password: string,
  params: Record<string, unknown>,
): string {
  const values = Object.keys(params)
    .filter((k) => k !== "signature" && k !== "response_signature_string")
    .sort()
    .map((k) => params[k])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map(String);
  return crypto
    .createHash("sha1")
    .update([password, ...values].join("|"))
    .digest("hex");
}

/**
 * Identifiant de commande unique côté boutique (Fondy le refuse en doublon).
 * ⚠️ Préfixé par boutique : deux boutiques qui partagent un compte marchand
 * Fondy se marcheraient dessus sur les identifiants de commande.
 */
export function newFondyOrderId(
  prefix = store.prefix.toUpperCase(),
): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto
    .randomBytes(4)
    .toString("hex")}`;
}

type FondyResponse = Record<string, unknown> & {
  response_status?: string;
  error_code?: number;
  error_message?: string;
};

async function call(
  path: string,
  creds: FondyCreds,
  params: Record<string, unknown>,
): Promise<{ data?: FondyResponse; error?: string }> {
  const request = {
    ...params,
    merchant_id: creds.merchantId,
    signature: fondySignature(creds.password, {
      ...params,
      merchant_id: creds.merchantId,
    }),
  };
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request }),
      cache: "no-store",
    });
    const json = await res.json();
    const data: FondyResponse = json?.response ?? {};
    if (data.response_status !== "success") {
      return {
        data,
        error: `Fondy : ${data.error_message ?? "réponse inattendue"}`,
      };
    }
    return { data };
  } catch (e) {
    return {
      error: e instanceof Error ? `Fondy : ${e.message}` : "Erreur réseau Fondy.",
    };
  }
}

export interface FondyCheckoutInput {
  orderId: string;
  /** Montant en CENTIMES (unité mineure), comme partout dans la boutique. */
  amount: number;
  currency: string;
  description: string;
  responseUrl: string;
  serverCallbackUrl: string;
  email?: string;
  lang?: string;
  /** Durée de validité du lien de paiement, en secondes. */
  lifetime?: number;
}

function checkoutParams(input: FondyCheckoutInput): Record<string, unknown> {
  return {
    order_id: input.orderId,
    order_desc: input.description,
    amount: String(input.amount),
    currency: input.currency,
    response_url: input.responseUrl,
    server_callback_url: input.serverCallbackUrl,
    sender_email: input.email || "",
    lang: input.lang ?? "fr",
    lifetime: String(input.lifetime ?? 3600),
  };
}

/** Jeton de paiement pour le widget embarqué (checkout.js). */
export async function fondyToken(
  creds: FondyCreds,
  input: FondyCheckoutInput,
): Promise<{ token?: string; error?: string }> {
  const { data, error } = await call("/checkout/token", creds, checkoutParams(input));
  if (error) return { error };
  const token = typeof data?.token === "string" ? data.token : undefined;
  return token ? { token } : { error: "Fondy : jeton de paiement absent." };
}

/** URL de la page de paiement hébergée (repli sans JavaScript). */
export async function fondyCheckoutUrl(
  creds: FondyCreds,
  input: FondyCheckoutInput,
): Promise<{ url?: string; error?: string }> {
  const { data, error } = await call("/checkout/url/", creds, checkoutParams(input));
  if (error) return { error };
  const url = typeof data?.checkout_url === "string" ? data.checkout_url : undefined;
  return url ? { url } : { error: "Fondy : URL de paiement absente." };
}

export type FondyOrderStatus =
  | "created"
  | "processing"
  | "declined"
  | "approved"
  | "expired"
  | "reversed";

export interface FondyStatus {
  status: FondyOrderStatus;
  /** Montant réellement encaissé, en centimes. */
  amount: number;
  currency: string;
  paymentId: string;
  reason: string;
}

/** État d'une commande côté Fondy — source de vérité avant de créer la commande. */
export async function fondyOrderStatus(
  creds: FondyCreds,
  orderId: string,
): Promise<{ status?: FondyStatus; error?: string }> {
  const { data, error } = await call("/status/order_id", creds, { order_id: orderId });
  if (error) return { error };
  const status = String(data?.order_status ?? "created") as FondyOrderStatus;
  return {
    status: {
      status,
      amount: Number(data?.amount ?? 0),
      currency: String(data?.currency ?? ""),
      paymentId: String(data?.payment_id ?? ""),
      reason: String(data?.response_description ?? data?.error_message ?? ""),
    },
  };
}

/**
 * Vérifie la signature d'un callback serveur Fondy. Le corps est signé avec le
 * même algorithme que les requêtes ; un callback non signé est ignoré.
 */
export function fondyVerifyCallback(
  password: string,
  body: Record<string, unknown>,
): boolean {
  const received = String(body.signature ?? "");
  if (!received) return false;
  const expected = fondySignature(password, body);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
