"use server";

import Stripe from "stripe";
import { headers } from "next/headers";
import { brand } from "@/config/brand.config";
import { store } from "@/config/store.config";
import { firstEnabledGateway, getGatewayConfig } from "@/lib/payments/gateway-store";
import {
  fondyCheckoutUrl,
  fondyCreds,
  fondyOrderStatus,
  fondyToken,
  newFondyOrderId,
} from "@/lib/payments/fondy";
import {
  AIRWALLEX_SUCCESS,
  airwallexCreateIntent,
  airwallexCreds,
  airwallexGetIntent,
} from "@/lib/payments/airwallex";
import {
  genomeAmountInCents,
  genomeCheckoutUrl,
  genomeCreds,
  newGenomeOrderId,
  type GenomeCallback,
} from "@/lib/payments/genome";
import { createOrderOnce } from "@/lib/payments/finalize";
import { createOrder } from "@/lib/actions/orders";
import { read, write } from "@/lib/db/store";
import { sendPaymentRefused } from "@/lib/emails";
import type { OrderItem } from "@/lib/db/seed";

export interface CheckoutDraft {
  customer: string;
  email: string;
  address?: string;
  items: OrderItem[];
  total: number;
}

async function origin(): Promise<string> {
  const h = await headers();
  const o = h.get("origin");
  if (o) return o;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
}

/**
 * Démarre le paiement avec la passerelle ACTIVÉE dans le back-office.
 * Renvoie une URL de redirection (interne pour "test", externe pour les PSP
 * hébergés). Stripe et Square s'encaissent sur place, via leurs propres
 * actions (`createStripeIntent` / `paySquare`).
 */
export async function startCheckout(
  draft: CheckoutDraft,
): Promise<{ url?: string; error?: string }> {
  const active = await firstEnabledGateway(brand.payments);
  if (!active) return { error: "Aucun moyen de paiement n'est activé." };

  // ── Processeur de test : validation immédiate ──
  if (active.id === "test") {
    const { id } = await createOrder({
      customer: draft.customer,
      email: draft.email,
      address: draft.address,
      items: draft.items,
      total: draft.total,
      psp: "Test (paiement simulé)",
    });
    return { url: `/order/${id}` };
  }

  // ── Stripe : voir createStripeIntent (Payment Element, formulaire sur place).
  if (active.id === "stripe") {
    return { error: "Stripe se règle sur place (Payment Element)." };
  }

  // ── Square : Payment Link (page hébergée + redirection) ──
  if (active.id === "square") {
    const accessToken = active.config.credentials.accessToken;
    const locationId = active.config.credentials.locationId;
    if (!accessToken || !locationId)
      return { error: "Clés Square manquantes (access token / location ID)." };
    try {
      const apiBase =
        active.config.mode === "live"
          ? "https://connect.squareup.com"
          : "https://connect.squareupsandbox.com";
      const base = await origin();
      const res = await fetch(`${apiBase}/v2/online-checkout/payment-links`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-12-18",
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          order: {
            location_id: locationId,
            line_items: draft.items.map((it) => ({
              name: `${it.name}${it.variantLabel ? ` — ${it.variantLabel}` : ""}`,
              quantity: String(it.qty),
              base_price_money: {
                amount: it.unitPrice,
                currency: brand.currency,
              },
            })),
          },
          checkout_options: { redirect_url: `${base}/checkout/square-success` },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          error: `Square : ${data?.errors?.[0]?.detail ?? "erreur d'initialisation"}`,
        };
      }
      const url: string | undefined = data.payment_link?.url;
      const orderId: string | undefined =
        data.payment_link?.order_id ??
        data.related_resources?.orders?.[0]?.id;
      if (!url || !orderId)
        return { error: "Square : réponse inattendue." };
      await write(`pending_sq_${orderId}`, { draft, done: false, orderId: null });
      return { url };
    } catch (e) {
      return {
        error:
          e instanceof Error
            ? `Square : ${e.message}`
            : "Erreur lors de l'initialisation du paiement Square.",
      };
    }
  }

  // ── Fondy : repli hébergé, utilisé seulement si le widget embarqué n'a pas
  //    pu se charger (sinon le paiement se règle sur place, voir createFondyToken).
  if (active.id === "fondy") {
    const creds = fondyCreds(active.config.credentials);
    if (!creds) return { error: "Clés Fondy manquantes (Merchant ID / mot de passe)." };
    const orderId = newFondyOrderId();
    const base = await fondyOrigin();
    const { url, error } = await fondyCheckoutUrl(creds, {
      orderId,
      amount: draft.total,
      currency: brand.currency,
      description: `Commande ${brand.name}`,
      responseUrl: `${base}/api/fondy/return?o=${encodeURIComponent(orderId)}`,
      serverCallbackUrl: `${base}/api/webhooks/fondy`,
      email: draft.email,
    });
    if (error || !url) return { error: error ?? "Fondy : initialisation impossible." };
    await write(fondyKey(orderId), {
      draft,
      amount: draft.total,
      done: false,
      orderId: null,
    });
    return { url };
  }

  // ── Genome : page de paiement hébergée (redirection + callback signé) ──
  if (active.id === "genome") {
    const creds = genomeCreds(active.config.credentials);
    if (!creds) return { error: "Clés Genome manquantes (clé et secret API)." };
    const orderId = newGenomeOrderId();
    const base = await origin();
    await write(genomeKey(orderId), {
      draft,
      amount: draft.total,
      done: false,
      orderId: null,
    });
    return {
      url: genomeCheckoutUrl(creds, {
        orderId,
        amount: draft.total,
        currency: brand.currency,
        description: `Commande ${brand.name}`,
        successUrl: `${base}/api/genome/return?o=${encodeURIComponent(orderId)}`,
        failureUrl: `${base}/checkout?error=${encodeURIComponent("Le paiement a été refusé.")}`,
        email: draft.email,
        lang: brand.locale.split("-")[0],
      }),
    };
  }

  // ── Autres PSP : clés stockées, intégration à finaliser ──
  return {
    error: `Le paiement via « ${active.id} » n'est pas encore activé. Contactez le gérant.`,
  };
}

/* ────────────────────────────── Fondy ────────────────────────────── */

const fondyKey = (orderId: string) => `pending_fd_${orderId}`;

/**
 * Base publique pour les URL transmises à Fondy. Son pare-feu répond 403 dès
 * qu'une URL pointe sur `localhost` : en dev on lui donne l'URL du site.
 * (Le retour de paiement atterrit alors en prod — le tunnel complet ne se teste
 * donc que sur le site déployé.)
 */
async function fondyOrigin(): Promise<string> {
  const base = await origin();
  return /localhost|127\.0\.0\.1/.test(base)
    ? (process.env.NEXT_PUBLIC_SITE_URL ?? base)
    : base;
}

interface FondyPending {
  /** Vide tant que le client n'a pas validé le formulaire. */
  draft: CheckoutDraft | null;
  /** Montant figé à la création du jeton — fait foi face au brouillon client. */
  amount: number;
  done: boolean;
  orderId: string | null;
  refused?: boolean;
}

/**
 * Prépare un paiement Fondy EMBARQUÉ : renvoie le jeton attendu par le widget
 * checkout.js. Appelé au montage du formulaire, donc avant que le client ait
 * saisi ses coordonnées — seul le montant est nécessaire ici, le brouillon de
 * commande est enregistré juste avant l'encaissement (`saveFondyDraft`).
 */
export async function createFondyToken(
  amount: number,
): Promise<{ token?: string; orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("fondy");
  if (!cfg?.enabled) return { error: "Fondy n'est pas activé." };
  const creds = fondyCreds(cfg.credentials);
  if (!creds) return { error: "Clés Fondy manquantes (Merchant ID / mot de passe)." };
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Montant invalide." };

  const orderId = newFondyOrderId();
  const base = await fondyOrigin();
  const { token, error } = await fondyToken(creds, {
    orderId,
    amount,
    currency: brand.currency,
    description: `Commande ${brand.name}`,
    responseUrl: `${base}/api/fondy/return?o=${encodeURIComponent(orderId)}`,
    serverCallbackUrl: `${base}/api/webhooks/fondy`,
  });
  if (error || !token) return { error: error ?? "Fondy : jeton indisponible." };

  await write(fondyKey(orderId), {
    draft: null,
    amount,
    done: false,
    orderId: null,
  } satisfies FondyPending);
  return { token, orderId };
}

/**
 * Enregistre le brouillon de commande juste avant de déclencher le paiement.
 * Le montant du brouillon doit correspondre à celui figé dans le jeton, sinon
 * on refuse : c'est ce qui empêche de payer 1 € une commande à 249 €.
 */
export async function saveFondyDraft(
  orderId: string,
  draft: CheckoutDraft,
): Promise<{ ok?: true; error?: string }> {
  const pending = await read<FondyPending | null>(fondyKey(orderId), null);
  if (!pending) return { error: "Session de paiement expirée, rechargez la page." };
  if (pending.done) return { error: "Ce paiement a déjà été traité." };
  if (draft.total !== pending.amount)
    return { error: "Le montant du panier a changé, rechargez la page." };
  await write(fondyKey(orderId), { ...pending, draft });
  return { ok: true };
}

/**
 * Vérifie l'état du paiement AUPRÈS DE FONDY puis crée la commande.
 * Idempotent : appelable en boucle par la page de retour et par le callback
 * serveur sans jamais créer deux commandes.
 */
export async function finalizeFondyPayment(
  orderId: string,
): Promise<{ orderId?: string; error?: string; pending?: true }> {
  const cfg = await getGatewayConfig("fondy");
  const creds = fondyCreds(cfg?.credentials);
  if (!creds) return { error: "Configuration Fondy manquante." };

  const pending = await read<FondyPending | null>(fondyKey(orderId), null);
  if (!pending) return { error: "Paiement introuvable." };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };

  const { status, error } = await fondyOrderStatus(creds, orderId);
  if (error || !status) return { error: error ?? "Fondy : statut indisponible." };

  if (status.status === "declined" || status.status === "expired") {
    if (!pending.refused && pending.draft) {
      await sendPaymentRefused(pending.draft.email, pending.draft.customer);
      await write(fondyKey(orderId), { ...pending, refused: true });
    }
    return {
      error:
        status.status === "expired"
          ? "La session de paiement a expiré."
          : `Paiement refusé${status.reason ? ` : ${status.reason.toLowerCase()}` : "."}`,
    };
  }

  if (status.status !== "approved") return { pending: true };

  const draft = pending.draft;
  if (!draft) return { error: "Coordonnées de commande introuvables." };
  // Le montant encaissé fait foi : s'il ne correspond pas, on n'enregistre rien
  // et le gérant tranche à la main (le débit, lui, existe côté Fondy).
  if (status.amount !== pending.amount)
    return { error: "Montant encaissé incohérent, contactez-nous." };

  // La page de retour et le webhook arrivent ensemble : une seule des deux
  // requêtes doit créer la commande.
  return createOrderOnce(`fd_${orderId}`, fondyKey(orderId), async () => {
    const { id } = await createOrder({
      customer: draft.customer,
      email: draft.email,
      address: draft.address,
      items: draft.items,
      total: draft.total,
      psp: "Fondy",
    });
    await write(fondyKey(orderId), { ...pending, done: true, orderId: id });
    return id;
  });
}

/* ───────────────────────────── Airwallex ───────────────────────────── */

const airwallexKey = (intentId: string) => `pending_aw_${intentId}`;

interface AirwallexPending {
  /** Montant figé à la création de l'intent — fait foi face au brouillon client. */
  amount: number;
  done: boolean;
  orderId: string | null;
}

/**
 * Prépare un paiement Airwallex EMBARQUÉ : crée le PaymentIntent et renvoie au
 * navigateur de quoi monter le Drop-in. Appelé au montage du formulaire, donc
 * avant que le client ait saisi ses coordonnées — seul le montant compte ici.
 */
export async function createAirwallexIntent(amount: number): Promise<{
  intentId?: string;
  clientSecret?: string;
  env?: "demo" | "prod";
  currency?: string;
  error?: string;
}> {
  const cfg = await getGatewayConfig("airwallex");
  if (!cfg?.enabled) return { error: "Airwallex n'est pas activé." };
  const creds = airwallexCreds(cfg.credentials);
  if (!creds) return { error: "Clés Airwallex manquantes (Client ID / clé API)." };
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Montant invalide." };

  const live = cfg.mode === "live";
  const { intent, error } = await airwallexCreateIntent(creds, live, {
    amount,
    currency: brand.currency,
    // Préfixe technique (et non le nom commercial) : c'est lui qui isole les
    // boutiques entre elles, et il reste stable si la marque est renommée.
    merchantOrderId: `${store.prefix.toUpperCase()}-${Date.now().toString(36)}`,
    returnUrl: `${await origin()}/checkout`,
  });
  if (error || !intent) return { error: error ?? "Airwallex : initialisation impossible." };

  await write(airwallexKey(intent.id), { amount, done: false, orderId: null });
  return {
    intentId: intent.id,
    clientSecret: intent.clientSecret,
    env: live ? "prod" : "demo",
    currency: intent.currency,
  };
}

/**
 * Transforme un paiement Airwallex confirmé en commande.
 *
 * ⚠️ Le succès annoncé par le SDK n'est qu'une information venant du navigateur
 * du client : on relit systématiquement l'intent auprès d'Airwallex avant
 * d'enregistrer quoi que ce soit.
 */
export async function finalizeAirwallexPayment(input: {
  intentId: string;
  draft: CheckoutDraft;
}): Promise<{ orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("airwallex");
  if (!cfg?.enabled) return { error: "Airwallex n'est pas activé." };
  const creds = airwallexCreds(cfg.credentials);
  if (!creds) return { error: "Clés Airwallex manquantes." };

  const pending = await read<AirwallexPending | null>(
    airwallexKey(input.intentId),
    null,
  );
  if (!pending) return { error: "Paiement introuvable." };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };

  const { intent, error } = await airwallexGetIntent(
    creds,
    cfg.mode === "live",
    input.intentId,
  );
  if (error || !intent) return { error: error ?? "Airwallex : statut indisponible." };

  if (intent.status !== AIRWALLEX_SUCCESS) {
    return { error: "Le paiement n'a pas été confirmé." };
  }
  // Le montant réellement encaissé fait foi, jamais le total envoyé par le client.
  if (intent.amount !== pending.amount) {
    return { error: "Montant encaissé incohérent, contactez-nous." };
  }

  return (
    await createOrderOnce(
      `aw_${input.intentId}`,
      airwallexKey(input.intentId),
      async () => {
        const { id } = await createOrder({
          customer: input.draft.customer,
          email: input.draft.email,
          address: input.draft.address,
          items: input.draft.items,
          total: pending.amount,
          psp: "Airwallex",
        });
        await write(airwallexKey(input.intentId), {
          ...pending,
          done: true,
          orderId: id,
        });
        return id;
      },
    )
  );
}

/* ────────────────────────────── Genome ────────────────────────────── */

const genomeKey = (orderId: string) => `pending_gn_${orderId}`;

interface GenomePending {
  draft: CheckoutDraft;
  /** Montant figé à la création du jeton — fait foi face au callback. */
  amount: number;
  done: boolean;
  orderId: string | null;
  refused?: boolean;
}

/**
 * Transforme un callback Genome VÉRIFIÉ en commande.
 *
 * ⚠️ À n'appeler qu'après validation de la signature (`genomeVerifyCallback`) :
 * cette fonction fait confiance au contenu qu'on lui passe. Contrairement à
 * Fondy, aucun second appel d'API ne peut confirmer le paiement — le callback
 * signé est la seule source de vérité, d'où l'exigence sur la signature.
 */
export async function finalizeGenomePayment(
  callback: GenomeCallback,
): Promise<{ orderId?: string; error?: string; pending?: true }> {
  const orderId = callback.order?.id;
  if (!orderId) return { error: "Identifiant de commande absent du callback." };

  const pending = await read<GenomePending | null>(genomeKey(orderId), null);
  if (!pending) return { error: "Paiement introuvable." };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };

  if (callback.event === "INCOMING_DECLINE") {
    if (!pending.refused) {
      await sendPaymentRefused(pending.draft.email, pending.draft.customer);
      await write(genomeKey(orderId), { ...pending, refused: true });
    }
    return { error: "Paiement refusé." };
  }

  // INCOMING_PAYMENT_CREATED / INCOMING_PLEDGE : le paiement n'est pas encaissé,
  // un INCOMING_SUCCESS suivra (ou non).
  if (callback.event !== "INCOMING_SUCCESS") return { pending: true };

  // Le montant annoncé par Genome fait foi : s'il ne correspond pas à celui que
  // nous avons signé, on n'enregistre rien et le gérant tranche à la main.
  const paid = genomeAmountInCents(callback);
  if (paid === null || paid !== pending.amount)
    return { error: "Montant encaissé incohérent, contactez-nous." };

  // Genome réémet ses callbacks tant qu'il n'a pas reçu de 200 : le verrou
  // garantit qu'un seul d'entre eux crée la commande.
  return createOrderOnce(`gn_${orderId}`, genomeKey(orderId), async () => {
    const { id } = await createOrder({
      customer: pending.draft.customer,
      email: pending.draft.email,
      address: pending.draft.address,
      items: pending.draft.items,
      total: pending.draft.total,
      psp: "Genome",
    });
    await write(genomeKey(orderId), { ...pending, done: true, orderId: id });
    return id;
  });
}

/**
 * Consultée par la page de retour : la commande est-elle déjà enregistrée ?
 *
 * Le navigateur revient souvent avant le callback serveur. Sans API de statut
 * chez Genome, on ne peut qu'attendre — d'où ces quelques secondes de patience
 * avant d'afficher « en cours de validation » plutôt qu'une erreur.
 */
export async function awaitGenomeOrder(
  orderId: string,
): Promise<{ orderId?: string; pending?: true }> {
  for (let i = 0; i < 12; i++) {
    const pending = await read<GenomePending | null>(genomeKey(orderId), null);
    if (pending?.done && pending.orderId) return { orderId: pending.orderId };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { pending: true };
}

/**
 * Encaisse un paiement Square EMBARQUÉ (Web Payments SDK) : la carte est
 * tokenisée côté client (iframe Square), on ne reçoit qu'un token à débiter.
 */
export async function paySquare(input: {
  token: string;
  /** Preuve d'authentification forte (3-D Secure) produite par `verifyBuyer`. */
  verificationToken?: string;
  draft: CheckoutDraft;
}): Promise<{ orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("square");
  if (!cfg?.enabled) return { error: "Square n'est pas activé." };
  const accessToken = cfg.credentials.accessToken;
  const locationId = cfg.credentials.locationId;
  if (!accessToken || !locationId)
    return { error: "Clés Square manquantes (access token / location ID)." };

  const apiBase =
    cfg.mode === "live"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  try {
    const res = await fetch(`${apiBase}/v2/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-12-18",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        source_id: input.token,
        verification_token: input.verificationToken,
        location_id: locationId,
        amount_money: {
          amount: input.draft.total,
          currency: brand.currency,
        },
        buyer_email_address: input.draft.email || undefined,
        note: `Commande ${brand.name}`,
      }),
    });
    const data = await res.json();
    const status = data.payment?.status;
    if (!res.ok || (status !== "COMPLETED" && status !== "APPROVED")) {
      await sendPaymentRefused(input.draft.email, input.draft.customer);
      return {
        error: `Paiement refusé : ${data?.errors?.[0]?.detail ?? "vérifiez votre carte."}`,
      };
    }
    const { id } = await createOrder({
      customer: input.draft.customer,
      email: input.draft.email,
      address: input.draft.address,
      items: input.draft.items,
      total: input.draft.total,
      psp: "Square",
    });
    return { orderId: id };
  } catch (e) {
    return {
      error:
        e instanceof Error ? `Square : ${e.message}` : "Erreur de paiement Square.",
    };
  }
}

/**
 * Stripe — Payment Element : crée le PaymentIntent au moment où le client
 * valide, une fois les champs carte déjà saisis sur la page. Le brouillon de
 * commande est mis de côté ; la commande n'est créée qu'après confirmation.
 */
export async function createStripeIntent(
  draft: CheckoutDraft,
): Promise<{ clientSecret?: string; error?: string }> {
  const cfg = await getGatewayConfig("stripe");
  if (!cfg?.enabled) return { error: "Stripe n'est pas activé." };
  const secret = cfg.credentials.secretKey;
  if (!secret) return { error: "Clé secrète Stripe manquante (back-office)." };

  try {
    const stripe = new Stripe(secret);
    const intent = await stripe.paymentIntents.create({
      amount: draft.total,
      currency: brand.currency.toLowerCase(),
      // Laisse Stripe proposer les moyens activés sur le compte (carte, wallets).
      automatic_payment_methods: { enabled: true },
      receipt_email: draft.email || undefined,
      description: `Commande ${brand.name}`,
    });
    await write(`pending_${intent.id}`, { draft, done: false, orderId: null });
    return { clientSecret: intent.client_secret ?? undefined };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Stripe : ${e.message}`
          : "Erreur lors de l'initialisation du paiement Stripe.",
    };
  }
}

/**
 * Confirme côté serveur qu'un PaymentIntent est bien payé, puis crée la
 * commande. Idempotent : rejoue sans risque (retour 3DS, double clic, webhook).
 */
export async function finalizeStripePayment(
  paymentIntentId: string,
): Promise<{ orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("stripe");
  const secret = cfg?.credentials.secretKey;
  if (!secret) return { error: "Configuration Stripe manquante." };

  const pending = await read<{
    draft: CheckoutDraft;
    done: boolean;
    orderId: string | null;
  } | null>(`pending_${paymentIntentId}`, null);
  if (!pending) return { error: "Paiement introuvable." };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };

  try {
    const stripe = new Stripe(secret);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return { error: "Le paiement n'a pas été confirmé." };
    }
    // Même course que chez Fondy : `/checkout/success` et le webhook
    // `payment_intent.succeeded` peuvent finaliser en même temps.
    const res = await createOrderOnce(
      `st_${paymentIntentId}`,
      `pending_${paymentIntentId}`,
      async () => {
        const { id } = await createOrder({
          customer: pending.draft.customer,
          email: pending.draft.email,
          address: pending.draft.address,
          items: pending.draft.items,
          total: pending.draft.total,
          psp: "Stripe",
        });
        await write(`pending_${paymentIntentId}`, {
          ...pending,
          done: true,
          orderId: id,
        });
        return id;
      },
    );
    if (res.orderId) return { orderId: res.orderId };
    return { error: "Paiement en cours de validation, patientez un instant." };
  } catch (e) {
    return {
      error: e instanceof Error ? `Stripe : ${e.message}` : "Erreur Stripe.",
    };
  }
}
