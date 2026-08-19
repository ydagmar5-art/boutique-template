import "server-only";

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  VIVA.COM — NATIVE CHECKOUT v2                                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Déroulé complet d'un paiement :
 *
 *   1. SERVEUR  — jeton OAuth2 (client credentials) auprès de `accounts.`
 *   2. SERVEUR  — création d'un ordre de paiement → `orderCode`
 *   3. NAVIGATEUR — le SDK `VivaPayments.cards` lit les champs carte et les
 *      envoie à `/nativecheckout/v2/chargetokens` avec le jeton OAuth
 *      → `chargeToken` (jeton à usage unique), 3-D Secure inclus
 *   4. SERVEUR  — débit de l'ordre avec ce `chargeToken` (auth Basic)
 *
 * ─── ⚠️ PÉRIMÈTRE PCI : SAQ A-EP, ET NON SAQ A ────────────────────────────
 * Contrairement à Stripe, Square et Airwallex, Viva n'héberge PAS les champs
 * carte dans une iframe. Le SDK lit de simples `<input data-vp="cardnumber">`
 * situés DANS notre page, et sérialise lui-même le PAN et le CVC :
 *
 *     { Number, CVC, HolderName, ExpirationYear, ExpirationMonth, Amount }
 *
 * Les données carte ne touchent jamais nos SERVEURS — elles vont du navigateur
 * directement chez Viva — mais elles transitent par notre DOM et notre contexte
 * JavaScript. Conséquences concrètes, à ne pas perdre de vue :
 *
 *  · Tout script tiers chargé sur la page de paiement peut lire ces champs.
 *    AUCUN pixel, tag manager ou outil d'analyse ne doit être ajouté au
 *    tunnel — c'est la règle qui protège cette intégration.
 *  · La boutique relève du questionnaire SAQ A-EP (scans ASV trimestriels).
 *  · Viva ouvre Native Checkout v2 sur demande : sa documentation est derrière
 *    authentification. L'activer sans leur accord expose au blocage du compte.
 *
 * ─── ⚠️ LE JETON OAUTH PART DANS LE NAVIGATEUR ────────────────────────────
 * L'étape 3 l'impose : le SDK signe sa requête avec un `Bearer`. Ce jeton est
 * donc À CONSIDÉRER COMME PUBLIC. Il est de durée courte et n'est demandé qu'au
 * moment de payer, mais l'application Viva qui le délivre ne doit porter que
 * les droits du checkout — jamais ceux des virements ou de la gestion de compte.
 */

export interface VivaCreds {
  merchantId: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  /** Code du « payment source » créé dans le back-office Viva (4 chiffres). */
  sourceCode: string;
}

export function vivaCreds(
  credentials: Record<string, string> | undefined,
): VivaCreds | null {
  const merchantId = credentials?.merchantId?.trim();
  const apiKey = credentials?.apiKey?.trim();
  const clientId = credentials?.clientId?.trim();
  const clientSecret = credentials?.clientSecret?.trim();
  const sourceCode = credentials?.sourceCode?.trim();
  if (!merchantId || !apiKey || !clientId || !clientSecret || !sourceCode) {
    return null;
  }
  return { merchantId, apiKey, clientId, clientSecret, sourceCode };
}

/* ─────────────────────────── Environnements ─────────────────────────── */

/** Ordres et transactions (authentification Basic). */
export const vivaApiBase = (live: boolean) =>
  live ? "https://www.vivapayments.com" : "https://demo.vivapayments.com";

/** Délivrance des jetons OAuth2. */
export const vivaAccountsBase = (live: boolean) =>
  live
    ? "https://accounts.vivapayments.com"
    : "https://demo-accounts.vivapayments.com";

/**
 * Base que le SDK utilise pour `/nativecheckout/v2/chargetokens`.
 * ⚠️ Distincte de `vivaApiBase` : les jetons de carte passent par `api.`,
 * les ordres par `www.`. Les intervertir donne un 404 silencieux.
 */
export const vivaNativeBase = (live: boolean) =>
  live ? "https://api.vivapayments.com" : "https://demo-api.vivapayments.com";

/** SDK Native Checkout v2, chargé dans la page de paiement. */
export const vivaSdkUrl = (live: boolean) =>
  live
    ? "https://www.vivapayments.com/web/checkout/v2/js"
    : "https://demo.vivapayments.com/web/checkout/v2/js";

const basic = (c: VivaCreds) =>
  "Basic " + Buffer.from(`${c.merchantId}:${c.apiKey}`).toString("base64");

/* ──────────────────────────── Jeton OAuth2 ──────────────────────────── */

const tokenCache = new Map<string, { token: string; expires: number }>();

/**
 * Jeton d'accès pour le SDK navigateur.
 *
 * Mis en cache par couple de clés : une authentification à chaque montage du
 * formulaire ajouterait un aller-retour avant l'affichage des champs.
 */
export async function vivaAccessToken(
  creds: VivaCreds,
  live: boolean,
): Promise<{ token?: string; error?: string }> {
  const cle = `${live ? "live" : "demo"}:${creds.clientId}`;
  const cached = tokenCache.get(cle);
  if (cached && cached.expires > Date.now()) return { token: cached.token };

  try {
    const res = await fetch(`${vivaAccountsBase(live)}/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Client credentials en en-tête plutôt que dans le corps : c'est la
        // forme attendue par le serveur d'identité de Viva.
        Authorization:
          "Basic " +
          Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.access_token) {
      return { error: `Viva : authentification refusée (${res.status}).` };
    }
    // Marge de 60 s sur l'expiration annoncée : un jeton qui expire pendant la
    // saisie de la carte ferait échouer le paiement sans explication.
    const dureeMs = Math.max(60, Number(data.expires_in ?? 3600) - 60) * 1000;
    tokenCache.set(cle, { token: data.access_token, expires: Date.now() + dureeMs });
    return { token: data.access_token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Viva injoignable." };
  }
}

/* ──────────────────────────── Ordre de paiement ──────────────────────────── */

export interface VivaOrderInput {
  /** Montant en CENTIMES — Viva compte dans la plus petite unité, comme nous. */
  amount: number;
  /** Référence interne, affichée sur le relevé marchand. */
  merchantTrns: string;
  /** Libellé montré à la cliente. */
  customerTrns: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

/**
 * Crée un ordre de paiement et renvoie son `orderCode`.
 *
 * ⚠️ INUTILISÉE PAR NATIVE CHECKOUT v2, qui débite le jeton de carte
 * directement. Conservée parce qu'elle est le point d'entrée de Smart Checkout
 * (page hébergée) : si Viva n'ouvre jamais Native Checkout v2, c'est par ici
 * que passera le repli, sans avoir à réécrire l'authentification.
 *
 * ⚠️ Un `orderCode` ne vaut que pour UN paiement : il ne doit jamais être
 * réutilisé d'un essai à l'autre, sous peine de refus.
 */
export async function vivaCreateOrder(
  creds: VivaCreds,
  live: boolean,
  input: VivaOrderInput,
): Promise<{ orderCode?: string; error?: string }> {
  try {
    const res = await fetch(`${vivaApiBase(live)}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: basic(creds) },
      body: JSON.stringify({
        Amount: input.amount,
        SourceCode: creds.sourceCode,
        MerchantTrns: input.merchantTrns,
        CustomerTrns: input.customerTrns,
        ...(input.fullName ? { FullName: input.fullName } : {}),
        ...(input.email ? { Email: input.email } : {}),
        ...(input.phone ? { Phone: input.phone } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ErrorCode !== 0 || !data?.OrderCode) {
      return {
        error:
          data?.ErrorText || `Viva : création de l'ordre refusée (${res.status}).`,
      };
    }
    return { orderCode: String(data.OrderCode) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Viva injoignable." };
  }
}

/* ───────────────────────────── Débit ───────────────────────────── */

/**
 * Statut d'une transaction aboutie.
 * `F` = Finished. Tout autre statut (`A` autorisée, `E` erreur, `X` annulée)
 * ne vaut PAS encaissement et ne doit jamais créer de commande.
 */
export const VIVA_FINISHED = "F";

export interface VivaTransaction {
  transactionId: string;
  statusId: string;
  /** Montant réellement débité, en centimes. */
  amount: number;
}

/**
 * Débite avec le jeton de carte à usage unique produit par le SDK.
 *
 *   POST api.vivapayments.com/nativecheckout/v2/transactions · Bearer OAuth
 *   corps : { amount, preauth, sourceCode, chargeToken, merchantTrns… }
 *
 * ⚠️ Le montant vient du MONTANT FIGÉ à la préparation du paiement, calculé
 * par le serveur à partir des lignes du panier. Il n'est jamais repris d'un
 * total envoyé par le navigateur.
 *
 * ⚠️ Cette voie ne transmet AUCUN `OrderCode` — c'est pourquoi la commande est
 * repérée par `merchantTrns`, notre propre référence, que Viva renvoie tel quel
 * dans le webhook. Sans ce rattachement, un encaissement arrivant par webhook
 * ne pourrait être relié à aucun panier.
 *
 * ⚠️ Non vérifiable tant que Viva n'a pas provisionné Native Checkout v2 :
 * `/nativecheckout/v2/*` répond 403 et aucun `chargeToken` ne peut être
 * produit. À valider par un paiement réel dès le déblocage.
 */
export async function vivaChargeToken(
  creds: VivaCreds,
  live: boolean,
  input: {
    chargeToken: string;
    /** Montant figé côté serveur, en CENTIMES. */
    amount: number;
    /** Notre référence — seul lien entre l'encaissement et le panier. */
    merchantTrns: string;
    customerTrns?: string;
    /**
     * ⚠️ OBLIGATOIRE. Sans cet objet, Viva refuse le débit avec
     * `400 — "Null Customer"`, et AUCUN paiement ne peut aboutir.
     *
     * Le défaut était invisible tant que Native Checkout v2 n'était pas
     * provisionné : le `403` masquait tout ce qui venait après. Il n'est
     * apparu qu'au premier débit réellement autorisé.
     */
    customer: {
      email: string;
      fullName?: string;
      phone?: string;
      countryCode?: string;
      requestLang?: string;
    };
  },
): Promise<{ transaction?: VivaTransaction; error?: string }> {
  const { token, error } = await vivaAccessToken(creds, live);
  if (error || !token) return { error: error ?? "Viva : jeton indisponible." };

  try {
    const res = await fetch(`${vivaNativeBase(live)}/nativecheckout/v2/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: input.amount,
        // Débit immédiat : une pré-autorisation ne déplacerait pas les fonds.
        preauth: false,
        sourceCode: creds.sourceCode,
        chargeToken: input.chargeToken,
        merchantTrns: input.merchantTrns,
        ...(input.customerTrns ? { customerTrns: input.customerTrns } : {}),
        customer: {
          email: input.customer.email,
          ...(input.customer.fullName ? { fullName: input.customer.fullName } : {}),
          ...(input.customer.phone ? { phone: input.customer.phone } : {}),
          countryCode: input.customer.countryCode ?? "FR",
          requestLang: input.customer.requestLang ?? "fr-FR",
        },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.transactionId) {
      return {
        error:
          data?.message ||
          data?.ErrorText ||
          `Viva : paiement refusé (${res.status}).`,
      };
    }
    return {
      transaction: {
        transactionId: String(data.transactionId),
        // La casse diffère de l'ancienne API : les deux formes sont acceptées
        // pour ne pas dépendre d'une version précise de leur réponse.
        statusId: String(data.statusId ?? data.StatusId ?? ""),
        amount: Number(data.amount ?? data.Amount ?? 0),
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Viva injoignable." };
  }
}

/**
 * Relit une transaction chez Viva.
 *
 * ⚠️ C'est LA vérification qui compte pour le webhook : le corps d'un webhook
 * Viva n'est pas signé, donc son contenu ne prouve rien. Seule cette relecture,
 * authentifiée avec nos clés, fait foi.
 */
export async function vivaGetTransaction(
  creds: VivaCreds,
  live: boolean,
  transactionId: string,
): Promise<{ transaction?: VivaTransaction; error?: string }> {
  try {
    const res = await fetch(
      `${vivaApiBase(live)}/api/transactions/${encodeURIComponent(transactionId)}`,
      { headers: { Authorization: basic(creds) }, signal: AbortSignal.timeout(20000) },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ErrorCode !== 0) {
      return {
        error: data?.ErrorText || `Viva : transaction introuvable (${res.status}).`,
      };
    }
    return {
      transaction: {
        transactionId,
        statusId: String(data.StatusId ?? ""),
        amount: Math.round(Number(data.Amount ?? 0) * 100),
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Viva injoignable." };
  }
}

/**
 * Clé de vérification des webhooks.
 *
 * ⚠️ Viva NE SIGNE PAS ses webhooks. À l'enregistrement d'une URL, il envoie un
 * `GET` et attend en réponse `{ "Key": "…" }` — cette clé prouve seulement que
 * l'URL appartient bien au marchand. Elle n'authentifie AUCUN appel ultérieur :
 * la sécurité vient de la relecture de la transaction, jamais du corps reçu.
 */
export async function vivaWebhookKey(
  creds: VivaCreds,
  live: boolean,
): Promise<{ key?: string; error?: string }> {
  try {
    const res = await fetch(`${vivaApiBase(live)}/api/messages/config/token`, {
      headers: { Authorization: basic(creds) },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.Key) {
      return { error: `Viva : clé de webhook indisponible (${res.status}).` };
    }
    return { key: String(data.Key) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Viva injoignable." };
  }
}
