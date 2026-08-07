import "server-only";
import crypto from "node:crypto";
import { store } from "@/config/store.config";

/**
 * Client Genome (https://genome.eu) — Hosted Payment Page.
 *
 * Le client est redirigé vers `pay.genome.eu?jwt=<jeton signé>`. Aucune donnée
 * carte ne transite par nos serveurs (périmètre PCI SAQ-A).
 *
 * ⚠️ Différence majeure avec Fondy : la documentation HPP n'expose PAS d'API
 * pour interroger le statut d'une commande. La seule preuve d'encaissement est
 * le callback serveur signé — c'est donc lui, et lui seul, qui crée la commande.
 *
 * server-only : le secret API signe les jetons, il ne doit jamais partir vers
 * le navigateur.
 */

/** Page de paiement hébergée. Genome utilise la même URL en test et en live :
 *  c'est le compte (et la devise de test XTS) qui distingue les deux. */
export const GENOME_PAY_URL = "https://pay.genome.eu";

export interface GenomeCreds {
  apiKey: string;
  apiSecret: string;
}

/** Extrait et valide les identifiants saisis dans le back-office. */
export function genomeCreds(
  credentials: Record<string, string> | undefined,
): GenomeCreds | null {
  const apiKey = credentials?.apiKey?.trim();
  const apiSecret = credentials?.apiSecret?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

/**
 * Clé de signature du JWT : Genome ne signe pas avec le secret tel quel, mais
 * avec son empreinte SHA-256 **en octets bruts** (et non sa représentation
 * hexadécimale — s'en écarter produit un jeton rejeté).
 */
const signingKey = (apiSecret: string) =>
  crypto.createHash("sha256").update(apiSecret).digest();

/** Identifiant de commande unique côté boutique. */
export function newGenomeOrderId(prefix = store.prefix.toUpperCase()): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto
    .randomBytes(4)
    .toString("hex")}`;
}

export interface GenomeCheckoutInput {
  orderId: string;
  /** Montant en centimes (unité interne de la boutique). */
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  failureUrl: string;
  email?: string;
  /** Code langue de la page de paiement (ISO 639-1). */
  lang?: string;
  /**
   * Claims `VALUE_*` d'identité (cf. `lib/payments/identity.ts`) : nom,
   * téléphone, adresse. Pré-remplissent la page hébergée et alimentent le
   * contrôle du risque de Genome.
   */
  identity?: Record<string, string>;
}

/**
 * Construit l'URL de paiement hébergée.
 *
 * Le jeton porte le montant et l'identifiant de commande : le client ne peut
 * donc pas les modifier en chemin, la signature ne tiendrait plus.
 */
export function genomeCheckoutUrl(
  creds: GenomeCreds,
  input: GenomeCheckoutInput,
): string {
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, string | number> = {
    iss: creds.apiKey,
    sub: input.orderId,
    iat: now,
    // La documentation impose une validité maximale de 30 minutes.
    exp: now + 25 * 60,
    jti: crypto.randomUUID(),
    VALUE_AMOUNT_ISO: input.currency,
    VALUE_AMOUNT_RAW: (input.amount / 100).toFixed(2),
    VALUE_ORDER_ID: input.orderId,
    VALUE_DESCRIPTION: input.description,
    VALUE_SUCCESS_URL: input.successUrl,
    VALUE_FAILURE_URL: input.failureUrl,
  };
  if (input.email) claims.VALUE_EMAIL = input.email;
  if (input.lang) claims.VALUE_LANG = input.lang;
  // Noms de claims relevés dans la documentation marchand (Hosted Payment
  // Page) : VALUE_FIRST_NAME, VALUE_LAST_NAME, VALUE_PHONE, VALUE_ADDRESS,
  // VALUE_CITY, VALUE_ZIP, VALUE_COUNTRY. Un claim vide n'est jamais envoyé.
  for (const [cle, valeur] of Object.entries(input.identity ?? {})) {
    if (valeur) claims[cle] = valeur;
  }

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const signature = crypto
    .createHmac("sha256", signingKey(creds.apiSecret))
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${GENOME_PAY_URL}?jwt=${header}.${payload}.${signature}`;
}

/** Comparaison à temps constant, tolérante aux longueurs différentes. */
function sameSignature(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Vérifie l'en-tête `X-Signature` d'un callback : HMAC-SHA256 du corps **brut**
 * (les octets reçus, jamais un JSON re-sérialisé — un espace de différence
 * invaliderait la signature).
 *
 * La documentation ne précise ni l'encodage de la signature ni si la clé est le
 * secret brut ou son empreinte (comme pour le JWT). On accepte donc les quatre
 * combinaisons plausibles : toutes dérivent du même secret, connu du seul
 * marchand, donc rien n'est affaibli. À resserrer sur la variante observée dès
 * le premier callback réel.
 */
export function genomeVerifyCallback(
  apiSecret: string,
  rawBody: string,
  received: string | null,
): boolean {
  if (!received) return false;
  const candidate = received.trim();
  for (const key of [apiSecret, signingKey(apiSecret)] as (string | Buffer)[]) {
    const mac = crypto.createHmac("sha256", key).update(rawBody, "utf8");
    const digest = mac.digest();
    if (
      sameSignature(candidate.toLowerCase(), digest.toString("hex")) ||
      sameSignature(candidate, digest.toString("base64"))
    ) {
      return true;
    }
  }
  return false;
}

/** Événements du callback (`event`). Seul INCOMING_SUCCESS encaisse. */
export type GenomeEvent =
  | "INCOMING_SUCCESS"
  | "INCOMING_DECLINE"
  | "INCOMING_PAYMENT_CREATED"
  | "INCOMING_PLEDGE";

export interface GenomeCallback {
  event?: GenomeEvent;
  is_test?: boolean;
  order?: {
    id?: string;
    description?: string;
    amount?: { amount?: number; currency?: string };
  };
  transaction?: { id?: number | string; status?: string; type?: string };
}

/** Montant du callback ramené en centimes, ou null s'il est inexploitable. */
export function genomeAmountInCents(cb: GenomeCallback): number | null {
  const raw = cb.order?.amount?.amount;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.round(raw * 100);
}
