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
  airwallexAttachIdentity,
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
import {
  mollieCreds,
  mollieCreatePayment,
  mollieGetPayment,
  toMajorUnits,
} from "@/lib/payments/mollie";
import {
  VIVA_FINISHED,
  vivaAccessToken,
  vivaChargeToken,
  vivaCreds,
  vivaGetTransaction,
  vivaNativeBase,
  vivaSdkUrl,
} from "@/lib/payments/viva";
import {
  airwallexShipping,
  fondyReservationData,
  genomeIdentityClaims,
  stripeShipping,
} from "@/lib/payments/identity";
import { createOrderOnce } from "@/lib/payments/finalize";
import { verifierRecuWhop, creerSessionWhop } from "@/lib/payments/whop";
import { sendTelegramAlert } from "@/lib/telegram";
import { serverTotal, validateCart } from "@/lib/payments/cart";
import { createOrder } from "@/lib/actions/orders";
import { read, write } from "@/lib/db/store";
import { sendPaymentRefused } from "@/lib/emails";
import type { OrderItem } from "@/lib/db/seed";
import type { AppliedDiscount } from "@/lib/promotions";

export interface CheckoutDraft {
  customer: string;
  email: string;
  address?: string;
  items: OrderItem[];
  total: number;
  /** Code promo saisi par le client. Sa validité est jugée côté serveur. */
  promoCode?: string;
  /** Remises retenues par le serveur — jamais renseigné par le navigateur. */
  discounts?: AppliedDiscount[];
  /** Total avant remise. */
  subtotal?: number;
  /** Origine de la visiteuse (cf. `lib/attribution.ts`). */
  source?: string;
  /*
    ── Identité structurée ──────────────────────────────────────────────
    `customer` et `address` restent la forme LISIBLE (back-office, e-mails).
    Ces champs-ci sont la forme MACHINE, attendue par les PSP : nom et
    prénom séparés, rue, code postal et ville distincts, téléphone.
    Facultatifs par prudence — un brouillon ancien ou un tunnel partiel ne
    doit pas faire échouer un encaissement (cf. `lib/payments/identity.ts`).
  */
  firstName?: string;
  lastName?: string;
  /** Téléphone du destinataire — exigé par le livreur, utile à l'anti-fraude. */
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
  /** ISO 3166-1 alpha-2. Absent = France. */
  country?: string;
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
/**
 * Reconstruit un brouillon avec les prix du CATALOGUE.
 *
 * Passage obligé de toute action qui encaisse : le panier arrive du
 * `localStorage` du client, donc son total et ses prix unitaires ne valent
 * rien tant qu'ils n'ont pas été recalculés ici (cf. `lib/payments/cart.ts`).
 */
async function secureDraft(
  draft: CheckoutDraft,
): Promise<{ draft?: CheckoutDraft; error?: string }> {
  // L'e-mail est transmis : c'est lui qui permet de refuser un code marqué
  // « utilisable une fois par cliente ». C'est ICI que le refus fait foi —
  // l'affichage du panier n'est qu'un confort.
  const { cart, error } = await validateCart(
    draft.items,
    draft.promoCode,
    draft.email,
  );
  if (error || !cart) return { error: error ?? "Panier invalide." };
  // Un code refusé ne bloque pas la commande : il est simplement ignoré, et le
  // client l'a déjà vu refusé sur la page (le total affiché est le bon).
  return {
    draft: {
      ...draft,
      items: cart.items,
      total: cart.total,
      subtotal: cart.subtotal,
      discounts: cart.discounts,
    },
  };
}

export async function startCheckout(
  input: CheckoutDraft,
): Promise<{ url?: string; error?: string }> {
  const active = await firstEnabledGateway(brand.payments);
  if (!active) return { error: "Aucun moyen de paiement n'est activé." };

  const checked = await secureDraft(input);
  if (checked.error || !checked.draft) return { error: checked.error };
  const draft = checked.draft;

  // ── Processeur de test : validation immédiate ──
  if (active.id === "test") {
    const { id } = await createOrder({
      customer: draft.customer,
      email: draft.email,
      address: draft.address,
      items: draft.items,
      total: draft.total,
      subtotal: draft.subtotal,
      discounts: draft.discounts,
      psp: "Test (paiement simulé)",
      phone: draft.phone,
      source: draft.source,
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
      // Anti-fraude et dossier de litige (cf. `lib/payments/identity.ts`).
      reservationData: fondyReservationData(draft),
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
        // Pré-remplit la page hébergée ET alimente son contrôle du risque.
        identity: genomeIdentityClaims(draft),
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
 * saisi ses coordonnées — on ne reçoit que le panier, le brouillon de commande
 * est enregistré juste avant l'encaissement (`saveFondyDraft`).
 *
 * ⚠️ Prend les LIGNES du panier, pas un montant : un montant envoyé par le
 * navigateur se choisit librement, et il serait ici figé dans le jeton signé.
 */
export async function createFondyToken(
  items: OrderItem[],
  promoCode?: string,
): Promise<{ token?: string; orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("fondy");
  if (!cfg?.enabled) return { error: "Fondy n'est pas activé." };
  const creds = fondyCreds(cfg.credentials);
  if (!creds) return { error: "Clés Fondy manquantes (Merchant ID / mot de passe)." };

  const { total: amount, error: cartError } = await serverTotal(items, promoCode);
  if (cartError || !amount) return { error: cartError ?? "Panier invalide." };

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
  input: CheckoutDraft,
): Promise<{ ok?: true; error?: string }> {
  const pending = await read<FondyPending | null>(fondyKey(orderId), null);
  if (!pending) return { error: "Session de paiement expirée, rechargez la page." };
  if (pending.done) return { error: "Ce paiement a déjà été traité." };

  const checked = await secureDraft(input);
  if (checked.error || !checked.draft) return { error: checked.error };
  // Le total recalculé doit correspondre à celui figé dans le jeton Fondy.
  if (checked.draft.total !== pending.amount)
    return { error: "Le montant du panier a changé, rechargez la page." };

  await write(fondyKey(orderId), { ...pending, draft: checked.draft });
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
      subtotal: draft.subtotal,
      discounts: draft.discounts,
      psp: "Fondy",
      phone: draft.phone,
      pspRef: status.paymentId || orderId,
      source: draft.source,
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
  /**
   * Coordonnées de la cliente, recopiées ici juste avant la confirmation.
   *
   * ⚠️ C'est ce qui rend le webhook capable de rattraper une commande. Le
   * navigateur envoie normalement ce brouillon après le paiement — mais s'il
   * ne revient jamais (onglet fermé, réseau coupé, 3-D Secure qui rend la main
   * sur une page morte), l'argent est encaissé et RIEN n'est enregistré : ni
   * commande, ni e-mail, ni ligne dans le tableau de bord. Sans ce champ, le
   * webhook n'aurait aucun moyen de savoir à qui expédier.
   *
   * Absent tant que la cliente n'a pas saisi ses coordonnées : un intent créé
   * au montage du formulaire puis abandonné n'en contient pas.
   */
  draft?: CheckoutDraft;
}

/**
 * Prépare un paiement Airwallex EMBARQUÉ : crée le PaymentIntent et renvoie au
 * navigateur de quoi monter les champs carte. Appelé au montage du formulaire,
 * donc avant que le client ait saisi ses coordonnées.
 *
 * ⚠️ Prend les LIGNES du panier, pas un montant : c'est ce montant qui sera
 * débité, il ne peut pas venir du navigateur.
 */
export async function createAirwallexIntent(
  items: OrderItem[],
  promoCode?: string,
): Promise<{
  intentId?: string;
  clientSecret?: string;
  env?: "demo" | "prod";
  currency?: string;
  /**
   * Montant figé, en CENTIMES. Renvoyé pour qu'Apple Pay affiche la somme
   * exacte qui sera débitée — elle doit venir du serveur, jamais d'un total
   * recalculé dans le navigateur.
   */
  amount?: number;
  error?: string;
}> {
  const cfg = await getGatewayConfig("airwallex");
  if (!cfg?.enabled) return { error: "Airwallex n'est pas activé." };
  const creds = airwallexCreds(cfg.credentials);
  if (!creds) return { error: "Clés Airwallex manquantes (Client ID / clé API)." };

  const { total: amount, error: cartError } = await serverTotal(items, promoCode);
  if (cartError || !amount) return { error: cartError ?? "Panier invalide." };

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
    amount,
  };
}

/**
 * Attache l'identité de la cliente à l'intent, juste avant la confirmation.
 *
 * Appelée depuis le formulaire, une fois les coordonnées saisies : l'intent,
 * lui, a été créé au montage des champs carte, quand on ne savait encore rien
 * de la cliente.
 *
 * ⚠️ Ne renvoie jamais d'erreur bloquante : le paiement passe avant tout.
 */
export async function attachAirwallexIdentity(
  intentId: string,
  draft: CheckoutDraft,
): Promise<{ ok: boolean }> {
  const cfg = await getGatewayConfig("airwallex");
  const creds = airwallexCreds(cfg?.credentials);
  if (!cfg?.enabled || !creds) return { ok: false };

  /* Le brouillon est recopié en base AVANT la confirmation : c'est le dernier
     moment où on le tient, et le seul instant où le webhook pourra encore le
     retrouver si le navigateur ne revient jamais. Une commande déjà créée
     n'est pas retouchée. */
  const pending = await read<AirwallexPending | null>(airwallexKey(intentId), null);
  if (pending && !pending.done) {
    await write(airwallexKey(intentId), { ...pending, draft });
  }

  return airwallexAttachIdentity(creds, cfg.mode === "live", intentId, {
    shipping: airwallexShipping(draft),
    email: draft.email || undefined,
    metadata: {
      boutique: brand.name,
      ...(draft.source ? { origine: draft.source } : {}),
    },
  });
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
          subtotal: input.draft.subtotal,
          discounts: input.draft.discounts,
          psp: "Airwallex",
          phone: input.draft.phone,
          pspRef: input.intentId,
          source: input.draft.source,
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

/**
 * Enregistre une commande payée par PORTEFEUILLE (Apple Pay, Google Pay).
 *
 * ⚠️ Pourquoi une action distincte de `finalizeAirwallexPayment` : le bouton
 * Apple Pay court-circuite le formulaire du site. Nom, adresse, téléphone et
 * e-mail ne viennent PAS de nos champs — ils sont fournis par la fiche Apple et
 * rattachés à l'intent par Airwallex. On les relit donc côté serveur, où ils
 * font foi, plutôt que de créer une commande sans destinataire.
 *
 * Le panier, lui, reste recalculé par le serveur : le portefeuille change la
 * manière de payer, pas le montant dû.
 */
export async function finalizeAirwallexWallet(input: {
  intentId: string;
  items: OrderItem[];
  promoCode?: string;
  /** Origine de la visite, seule donnée utile encore détenue par le navigateur. */
  source?: string;
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
  if (intent.amount !== pending.amount) {
    return { error: "Montant encaissé incohérent, contactez-nous." };
  }

  /* `validateCart` et non `serverTotal` : on a besoin du sous-total et du
     détail des remises pour que la commande porte les mêmes lignes qu'un
     paiement par carte. Le montant débité, lui, reste celui figé à la création
     de l'intent. */
  const { cart } = await validateCart(input.items, input.promoCode);
  const contact = intent.contact ?? {};

  const draft: CheckoutDraft = {
    // Apple transmet un nom dès qu'on le demande ; le repli évite une commande
    // anonyme si la fiche du porteur était incomplète.
    customer: contact.name || "Client Apple Pay",
    email: contact.email ?? "",
    address: contact.address,
    items: cart?.items ?? input.items,
    total: pending.amount,
    subtotal: cart?.subtotal,
    discounts: cart?.discounts,
    phone: contact.phone,
    source: input.source,
  };

  return createOrderOnce(
    `aw_${input.intentId}`,
    airwallexKey(input.intentId),
    async () => {
      const { id } = await createOrder({
        customer: draft.customer,
        email: draft.email,
        address: draft.address,
        items: draft.items,
        total: pending.amount,
        subtotal: draft.subtotal,
        discounts: draft.discounts,
        psp: "Airwallex",
        phone: draft.phone,
        pspRef: input.intentId,
        source: draft.source,
      });
      // Le brouillon est conservé : le webhook s'en sert s'il repasse derrière.
      await write(airwallexKey(input.intentId), {
        ...pending,
        draft,
        done: true,
        orderId: id,
      });
      return id;
    },
  );
}

/**
 * Rattrape un paiement Airwallex encaissé dont le navigateur n'est jamais
 * revenu. Appelée par le webhook, qui ne connaît que l'identifiant de l'intent.
 *
 * ⚠️ Ne PAS confondre avec un doublon : `finalizeAirwallexPayment` s'appuie sur
 * `createOrderOnce`, qui rend la commande déjà créée au lieu d'en ouvrir une
 * seconde. Le chemin navigateur et le chemin webhook peuvent donc se croiser
 * sans risque — c'est justement ce qui permet de garder les deux.
 *
 * Renvoie un motif plutôt qu'une erreur : un intent abandonné avant saisie des
 * coordonnées est un cas NORMAL (formulaire ouvert puis quitté), pas un
 * incident à signaler.
 */
export async function finalizeAirwallexFromWebhook(
  intentId: string,
): Promise<{ orderId?: string; skipped?: string; error?: string }> {
  const pending = await read<AirwallexPending | null>(airwallexKey(intentId), null);
  if (!pending) return { skipped: "intent inconnu de la boutique" };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };
  if (!pending.draft) {
    // Encaissé sans coordonnées : impossible d'expédier. Ce cas ne devrait pas
    // se produire, la confirmation étant précédée de l'envoi du brouillon —
    // mais s'il survient, il doit être VU, pas absorbé en silence.
    return { error: "paiement encaissé sans coordonnées client" };
  }
  return finalizeAirwallexPayment({ intentId, draft: pending.draft });
}

/* ─────────────────────────── Viva.com ─────────────────────────── */

/**
 * ⚠️ La clé est NOTRE référence (`merchantTrns`), pas un code d'ordre Viva.
 *
 * Native Checkout v2 débite directement le jeton de carte, sans passer par un
 * ordre de paiement : il n'y a donc aucun `OrderCode` à quoi se raccrocher.
 * C'est cette référence, transmise à Viva au moment du débit et renvoyée telle
 * quelle dans le webhook, qui relie l'encaissement au panier.
 */
const vivaKey = (ref: string) => `pending_viva_${ref}`;

interface VivaPending {
  /** Montant figé à la préparation — fait foi face au brouillon client. */
  amount: number;
  done: boolean;
  orderId: string | null;
  /** Coordonnées, pour que le webhook sache à qui expédier. Voir `AirwallexPending`. */
  draft?: CheckoutDraft;
}

/**
 * Prépare un paiement Viva et renvoie au navigateur de quoi monter les champs
 * carte.
 *
 * ⚠️ Prend les LIGNES du panier, jamais un montant : c'est ce montant-là qui
 * sera débité, et il ne peut pas venir du navigateur.
 *
 * ⚠️ Renvoie un jeton OAuth au navigateur — le SDK l'exige pour signer sa
 * requête de tokenisation. Il est délivré ICI, au plus près du paiement, plutôt
 * qu'au chargement de la page : sa durée de vie couvre la saisie de la carte et
 * rien de plus.
 */
export async function createVivaPayment(
  items: OrderItem[],
  promoCode?: string,
): Promise<{
  ref?: string;
  accessToken?: string;
  sdkUrl?: string;
  baseUrl?: string;
  amount?: number;
  error?: string;
}> {
  const cfg = await getGatewayConfig("viva");
  if (!cfg?.enabled) return { error: "Viva n'est pas activé." };
  const creds = vivaCreds(cfg.credentials);
  if (!creds) {
    return { error: "Clés Viva incomplètes (Merchant ID, API, OAuth, code source)." };
  }

  const { total: amount, error: cartError } = await serverTotal(items, promoCode);
  if (cartError || !amount) return { error: cartError ?? "Panier invalide." };

  const live = cfg.mode === "live";
  const { token, error } = await vivaAccessToken(creds, live);
  if (error || !token) return { error: error ?? "Viva : jeton indisponible." };

  // Préfixe technique et non le nom commercial : c'est lui qui isole les
  // boutiques entre elles, et il survit à un changement de marque.
  const ref = `${store.prefix.toUpperCase()}-${Date.now().toString(36)}`;
  await write(vivaKey(ref), { amount, done: false, orderId: null });

  return {
    ref,
    accessToken: token,
    sdkUrl: vivaSdkUrl(live),
    baseUrl: vivaNativeBase(live),
    amount,
  };
}

/**
 * Recopie les coordonnées avant la confirmation, pour que le webhook puisse
 * rattraper un paiement dont le navigateur ne revient jamais.
 *
 * ⚠️ Ne renvoie jamais d'erreur bloquante : le paiement passe avant tout.
 */
export async function saveVivaDraft(
  ref: string,
  draft: CheckoutDraft,
): Promise<{ ok: boolean }> {
  const pending = await read<VivaPending | null>(vivaKey(ref), null);
  if (!pending || pending.done) return { ok: false };
  await write(vivaKey(ref), { ...pending, draft });
  return { ok: true };
}

/**
 * Débite avec le jeton de carte produit par le SDK, puis enregistre la commande.
 *
 * ⚠️ Le montant transmis à Viva est celui figé à la préparation, relu en base.
 * Un navigateur ne peut donc pas choisir son prix.
 */
export async function payViva(input: {
  ref: string;
  chargeToken: string;
  draft: CheckoutDraft;
}): Promise<{ orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("viva");
  if (!cfg?.enabled) return { error: "Viva n'est pas activé." };
  const creds = vivaCreds(cfg.credentials);
  if (!creds) return { error: "Clés Viva manquantes." };

  const pending = await read<VivaPending | null>(vivaKey(input.ref), null);
  if (!pending) return { error: "Paiement introuvable." };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };

  const { transaction, error } = await vivaChargeToken(creds, cfg.mode === "live", {
    chargeToken: input.chargeToken,
    amount: pending.amount,
    merchantTrns: input.ref,
    customerTrns: brand.name,
    // Obligatoire côté Viva — voir `vivaChargeToken`. Les coordonnées viennent
    // du tunnel, jamais de la carte : c'est à cette adresse qu'on expédie.
    customer: {
      email: input.draft.email,
      fullName: input.draft.customer || undefined,
      phone: input.draft.phone || undefined,
      countryCode: input.draft.country || "FR",
      requestLang: brand.locale,
    },
  });
  if (error || !transaction) {
    return { error: error ?? "Le paiement n'a pas abouti." };
  }
  if (transaction.statusId !== VIVA_FINISHED) {
    // Une transaction seulement autorisée (`A`) n'est pas encaissée : créer la
    // commande ici reviendrait à expédier sans avoir été payé.
    return { error: "Le paiement n'a pas été confirmé par la banque." };
  }

  return enregistrerCommandeViva(
    input.ref,
    pending,
    input.draft,
    transaction.transactionId,
  );
}

/** Écriture de la commande, partagée par le chemin navigateur et le webhook. */
async function enregistrerCommandeViva(
  ref: string,
  pending: VivaPending,
  draft: CheckoutDraft,
  transactionId: string,
): Promise<{ orderId?: string; error?: string }> {
  return createOrderOnce(`viva_${ref}`, vivaKey(ref), async () => {
    const { id } = await createOrder({
      customer: draft.customer,
      email: draft.email,
      address: draft.address,
      items: draft.items,
      // Le montant figé à la préparation, jamais celui du brouillon.
      total: pending.amount,
      subtotal: draft.subtotal,
      discounts: draft.discounts,
      psp: "Viva.com",
      phone: draft.phone,
      pspRef: transactionId,
      source: draft.source,
    });
    await write(vivaKey(ref), { ...pending, done: true, orderId: id });
    return id;
  });
}

/**
 * Rattrape un paiement Viva encaissé dont le navigateur n'est jamais revenu.
 * Appelée par le webhook, qui identifie le panier par notre `merchantTrns`.
 *
 * ⚠️ Le corps du webhook ne prouve rien — Viva ne le signe pas. Le statut est
 * donc TOUJOURS relu chez Viva avec nos clés avant d'enregistrer quoi que ce
 * soit.
 */
export async function finalizeVivaFromWebhook(input: {
  ref: string;
  transactionId: string;
}): Promise<{ orderId?: string; skipped?: string; error?: string }> {
  const cfg = await getGatewayConfig("viva");
  if (!cfg?.enabled) return { skipped: "passerelle désactivée" };
  const creds = vivaCreds(cfg.credentials);
  if (!creds) return { skipped: "clés absentes" };

  const pending = await read<VivaPending | null>(vivaKey(input.ref), null);
  if (!pending) return { skipped: "référence inconnue de la boutique" };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };
  if (!pending.draft) return { error: "paiement encaissé sans coordonnées client" };

  const { transaction, error } = await vivaGetTransaction(
    creds,
    cfg.mode === "live",
    input.transactionId,
  );
  if (error || !transaction) return { error: error ?? "statut Viva indisponible" };
  if (transaction.statusId !== VIVA_FINISHED) {
    return { skipped: `statut ${transaction.statusId || "inconnu"}` };
  }
  // Le montant relu fait foi : un webhook forgé annonçant une autre somme ne
  // pourrait pas franchir cette comparaison.
  if (transaction.amount !== pending.amount) {
    return { error: "montant encaissé incohérent" };
  }

  return enregistrerCommandeViva(
    input.ref,
    pending,
    pending.draft,
    input.transactionId,
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
      subtotal: pending.draft.subtotal,
      discounts: pending.draft.discounts,
      psp: "Genome",
      phone: pending.draft.phone,
      pspRef: String(callback.transaction?.id ?? orderId),
      source: pending.draft?.source,
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
export async function paySquare(request: {
  token: string;
  /** Preuve d'authentification forte (3-D Secure) produite par `verifyBuyer`. */
  verificationToken?: string;
  draft: CheckoutDraft;
}): Promise<{ orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("square");
  if (!cfg?.enabled) return { error: "Square n'est pas activé." };

  // Le débit se fait sur le total du catalogue, pas sur celui du navigateur.
  const checked = await secureDraft(request.draft);
  if (checked.error || !checked.draft) return { error: checked.error };
  const input = { ...request, draft: checked.draft };
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
      subtotal: input.draft.subtotal,
      discounts: input.draft.discounts,
      psp: "Square",
      phone: input.draft.phone,
      pspRef: String(data.payment?.id ?? ""),
      source: input.draft.source,
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
  input: CheckoutDraft,
): Promise<{ clientSecret?: string; error?: string }> {
  const cfg = await getGatewayConfig("stripe");
  if (!cfg?.enabled) return { error: "Stripe n'est pas activé." };
  const secret = cfg.credentials.secretKey;
  if (!secret) return { error: "Clé secrète Stripe manquante (back-office)." };

  // Le montant débité vient du catalogue, jamais du total envoyé par le client.
  const checked = await secureDraft(input);
  if (checked.error || !checked.draft) return { error: checked.error };
  const draft = checked.draft;

  try {
    const stripe = new Stripe(secret);
    const intent = await stripe.paymentIntents.create({
      amount: draft.total,
      currency: brand.currency.toLowerCase(),
      // Laisse Stripe proposer les moyens activés sur le compte (carte, wallets).
      automatic_payment_methods: { enabled: true },
      receipt_email: draft.email || undefined,
      description: `Commande ${brand.name}`,
      /*
        Identité du destinataire (cf. `lib/payments/identity.ts`).
        Sans elle, Radar ne peut pas comparer l'adresse de facturation de la
        carte à l'adresse de livraison — le contrôle anti-fraude le plus
        discriminant — et un litige « colis non reçu » se défend à la main.
      */
      shipping: stripeShipping(draft),
      metadata: {
        boutique: brand.name,
        ...(draft.source ? { origine: draft.source } : {}),
      },
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
          subtotal: pending.draft.subtotal,
          discounts: pending.draft.discounts,
          psp: "Stripe",
          phone: pending.draft.phone,
          pspRef: paymentIntentId,
          source: pending.draft.source,
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

/* ───────────────────────────── Mollie ───────────────────────────── */

/**
 * Le brouillon est indexé sur NOTRE référence, pas sur l'identifiant Mollie.
 *
 * ⚠️ `redirectUrl` doit être fourni à la CRÉATION du paiement, donc avant que
 * Mollie n'ait attribué son `tr_…` : impossible d'y mettre son identifiant.
 * On génère donc une référence à nous, on la place dans l'URL de retour ET
 * dans les métadonnées du paiement — le webhook, qui ne connaît que le `tr_…`,
 * la retrouve en relisant le paiement.
 */
const mollieKey = (reference: string) => `pending_ml_${reference}`;

interface MolliePending {
  draft: CheckoutDraft;
  /** Montant figé à la création du paiement — fait foi face au brouillon client. */
  amount: number;
  /** Identifiant Mollie (`tr_…`), connu seulement après création. */
  paymentId: string;
  done: boolean;
  orderId: string | null;
  refused?: boolean;
}

/**
 * Encaisse avec Mollie à partir du `cardToken` produit par les Components.
 *
 * Le jeton ne porte AUCUN montant : le total est recalculé ici depuis le
 * catalogue (`secureDraft`), jamais repris du navigateur.
 *
 * ⚠️ Mollie renvoie une URL de 3-D Secure dans la quasi-totalité des cas : le
 * tunnel redirige alors, et reprend la main sur `/api/mollie/return`.
 */
export async function payMollie(
  cardToken: string,
  input: CheckoutDraft,
): Promise<{ redirectUrl?: string; orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("mollie");
  if (!cfg?.enabled) return { error: "Mollie n'est pas activé." };
  const creds = mollieCreds(cfg.credentials);
  if (!creds) return { error: "Clés Mollie manquantes (Profile ID / clé API)." };
  if (!cardToken) return { error: "Veuillez saisir une carte valide." };

  const checked = await secureDraft(input);
  if (checked.error || !checked.draft) return { error: checked.error };
  const draft = checked.draft;

  const base = await origin();
  const reference = `${store.prefix.toUpperCase()}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const { payment, error } = await mollieCreatePayment(creds, {
    cardToken,
    amount: draft.total,
    currency: brand.currency,
    description: `Commande ${brand.name}`,
    redirectUrl: `${base}/api/mollie/return?o=${encodeURIComponent(reference)}`,
    webhookUrl: `${base}/api/webhooks/mollie`,
    reference,
  });
  if (error || !payment) return { error: error ?? "Mollie : paiement refusé." };

  await write(mollieKey(reference), {
    draft,
    amount: draft.total,
    paymentId: payment.id,
    done: false,
    orderId: null,
  } satisfies MolliePending);

  const checkout = payment._links?.checkout?.href;
  if (checkout) return { redirectUrl: checkout };

  // Aucun 3-D Secure demandé : le sort du paiement est déjà scellé.
  const res = await finalizeMolliePayment(reference);
  return res.orderId ? { orderId: res.orderId } : { error: res.error };
}

/**
 * Relit le paiement chez Mollie puis crée la commande.
 *
 * ⚠️ Le retour du navigateur ne porte AUCUNE information de statut : Mollie
 * renvoie le client sur `redirectUrl` que le paiement ait réussi, échoué ou
 * été annulé. Seule cette relecture fait foi.
 *
 * Idempotent : la page de retour et le webhook y passent tous deux, souvent à
 * quelques millisecondes d'écart.
 */
export async function finalizeMolliePayment(
  reference: string,
): Promise<{ orderId?: string; error?: string; pending?: true }> {
  const cfg = await getGatewayConfig("mollie");
  const creds = mollieCreds(cfg?.credentials);
  if (!creds) return { error: "Configuration Mollie manquante." };

  const pending = await read<MolliePending | null>(mollieKey(reference), null);
  if (!pending) return { error: "Paiement introuvable." };
  if (pending.done && pending.orderId) return { orderId: pending.orderId };

  const { payment, error } = await mollieGetPayment(creds, pending.paymentId);
  if (error || !payment) return { error: error ?? "Mollie : statut indisponible." };

  if (payment.status === "canceled" || payment.status === "expired" || payment.status === "failed") {
    if (!pending.refused) {
      await sendPaymentRefused(pending.draft.email, pending.draft.customer);
      await write(mollieKey(reference), { ...pending, refused: true });
    }
    return {
      error:
        payment.status === "expired"
          ? "La session de paiement a expiré."
          : payment.details?.failureMessage
            ? `Paiement refusé : ${payment.details.failureMessage.toLowerCase()}`
            : "Paiement refusé par votre banque.",
    };
  }

  if (payment.status !== "paid") return { pending: true };

  // Le montant encaissé fait foi. Mollie renvoie une chaîne en unités
  // majeures : on la compare à celle qu'on avait figée, pas à un nombre.
  if (payment.amount.value !== toMajorUnits(pending.amount))
    return { error: "Montant encaissé incohérent, contactez-nous." };

  return createOrderOnce(`ml_${reference}`, mollieKey(reference), async () => {
    const { id } = await createOrder({
      customer: pending.draft.customer,
      email: pending.draft.email,
      address: pending.draft.address,
      items: pending.draft.items,
      total: pending.draft.total,
      subtotal: pending.draft.subtotal,
      discounts: pending.draft.discounts,
      psp: "Mollie",
      phone: pending.draft.phone,
      pspRef: pending.paymentId,
      source: pending.draft.source,
    });
    await write(mollieKey(reference), { ...pending, done: true, orderId: id });
    return id;
  });
}

/**
 * Retrouve notre référence à partir d'un identifiant Mollie.
 * Utilisé par le webhook, qui ne reçoit que le `tr_…`.
 */
export async function mollieReferenceOf(
  paymentId: string,
): Promise<string | null> {
  const cfg = await getGatewayConfig("mollie");
  const creds = mollieCreds(cfg?.credentials);
  if (!creds) return null;
  const { payment } = await mollieGetPayment(creds, paymentId);
  const ref = (payment as { metadata?: { reference?: string } } | undefined)
    ?.metadata?.reference;
  return typeof ref === "string" && ref ? ref : null;
}

/**
 * Whop — checkout embarqué.
 *
 * Le widget encaisse dans son iframe puis appelle `onCheckoutComplete` DANS LE
 * NAVIGATEUR. Ce rappel n'est pas une preuve de paiement : cette action le
 * revérifie côté serveur avant de créer quoi que ce soit.
 *
 * ⚠️ `createOrderOnce` protège du doublon : un client qui rafraîchit ou un
 * rappel émis deux fois par le widget ne doit pas produire deux commandes
 * pour un seul encaissement.
 */
export async function payWhop(request: {
  receiptId: string;
  planId: string;
  draft: CheckoutDraft;
}): Promise<{ orderId?: string; error?: string }> {
  const cfg = await getGatewayConfig("whop");
  if (!cfg?.enabled) return { error: "Whop n'est pas activé." };

  // Le montant retenu vient du CATALOGUE, jamais du navigateur.
  const checked = await secureDraft(request.draft);
  if (checked.error || !checked.draft) return { error: checked.error };
  const draft = checked.draft;

  const recu = String(request.receiptId || "").trim();
  if (!recu) return { error: "Paiement Whop sans référence de reçu." };

  const verdict = await verifierRecuWhop(recu, cfg.credentials.apiKey ?? "");
  if (verdict.etat === "refuse") {
    await sendPaymentRefused(draft.email, draft.customer);
    return { error: "Ce paiement n'a pas été confirmé par Whop." };
  }

  /*
    Le montant encaissé par Whop est celui du PLAN. S'il ne correspond pas au
    panier, on refuse : livrer une commande à 129 € encaissée 39 € serait une
    perte sèche, et c'est le scénario exact d'un plan mal associé à une offre.
    Tolérance de 1 centime pour les arrondis de change.
  */
  if (verdict.etat === "paye" && typeof verdict.montantCents === "number") {
    if (Math.abs(verdict.montantCents - draft.total) > 1) {
      return {
        error:
          "Le montant encaissé ne correspond pas à la commande. Aucune commande n'a été créée — prévenez-nous.",
      };
    }
  }

  const nonVerifie = verdict.etat === "indisponible";
  const { orderId } = await createOrderOnce(`whop_${recu}`, recu, async () => {
    const { id } = await createOrder({
      customer: draft.customer,
      email: draft.email,
      address: draft.address,
      items: draft.items,
      total: draft.total,
      subtotal: draft.subtotal,
      discounts: draft.discounts,
      psp: nonVerifie ? "Whop (non vérifié)" : "Whop",
      phone: draft.phone,
      pspRef: recu,
      source: draft.source,
    });
    return id;
  });
  const id = orderId;

  if (nonVerifie) {
    // La vente n'est pas bloquée, mais le gérant doit confronter au tableau
    // de bord Whop AVANT de livrer.
    await sendTelegramAlert(
      `⚠️ Paiement Whop NON VÉRIFIÉ — commande ${id}, reçu ${recu} : ${verdict.raison}. ` +
        "Vérifiez l'encaissement dans le tableau de bord Whop avant de livrer.",
    ).catch(() => {});
  }
  return { orderId: id };
}

/**
 * Whop — prépare un paiement au montant EXACT du panier.
 *
 * Le total est recalculé côté serveur (`secureDraft`) puis figé dans une
 * configuration de checkout Whop. C'est ce qui rend les remises, les paniers
 * à plusieurs lignes et les produits créés dans /admin encaissables sans
 * jamais créer de plan à la main.
 *
 * ⚠️ Le montant retourné sert UNIQUEMENT à l'affichage. Ce qui fait foi, c'est
 * le prix inscrit dans la configuration côté Whop, recalculé ici depuis le
 * catalogue — jamais un total venu du navigateur.
 */
export async function demarrerWhop(input: CheckoutDraft): Promise<{
  planId?: string;
  sessionId?: string;
  total?: number;
  error?: string;
}> {
  const cfg = await getGatewayConfig("whop");
  if (!cfg?.enabled) return { error: "Whop n'est pas activé." };

  const checked = await secureDraft(input);
  if (checked.error || !checked.draft) return { error: checked.error };
  const draft = checked.draft;

  const res = await creerSessionWhop(
    draft.total,
    cfg.credentials.apiKey ?? "",
    {
      boutique: brand.name,
      // Retrouver la commande depuis Whop en cas de litige.
      panier: draft.items.map((i) => `${i.slug}x${i.qty}`).join(","),
      email: draft.email || "",
    },
    cfg.credentials.productId,
  );
  if ("erreur" in res) return { error: res.erreur };
  return { planId: res.planId, sessionId: res.sessionId, total: draft.total };
}
