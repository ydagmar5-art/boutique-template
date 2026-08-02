"use client";

import { brand } from "@/config/brand.config";
import { paySquare } from "@/lib/actions/checkout";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import type { OrderItem } from "@/lib/db/seed";
import SquareCard from "@/components/shop/SquareCard";
import StripeCard from "@/components/shop/StripeCard";
import FondyCard from "@/components/shop/FondyCard";
import AirwallexCard from "@/components/shop/AirwallexCard";

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  REGISTRE DES PSP EMBARQUÉS — le checkout ne connaît que ce fichier  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Le tunnel de paiement ne contient plus aucun « si c'est Stripe… si c'est
 * Square… ». Il demande au registre : « ce PSP sait-il encaisser sur place ? »
 * — si oui il affiche ses champs et appelle `confirm`, sinon il redirige.
 *
 * ─── Brancher un nouveau PSP embarqué ───────────────────────────────────
 *  1. `lib/payments/public-config.ts` : quelles clés PUBLIQUES le navigateur
 *     reçoit (jamais un secret).
 *  2. Ici : une entrée `Fields` qui affiche les champs et remonte un `confirm`.
 *  3. Une action serveur qui encaisse (comme `paySquare`).
 * Aucune autre modification n'est nécessaire — ni ici, ni dans le checkout.
 *
 * ⚠️ Un PSP n'a le droit de figurer ici que si ses champs carte sont hébergés
 * par LUI (iframe / SDK). Si les numéros de carte devaient transiter par nos
 * serveurs, la boutique basculerait en PCI DSS SAQ-D : ces PSP-là restent en
 * redirection, c'est le cas de Genome.
 */

/** Contexte transmis au PSP au moment de payer. */
export interface PayContext {
  draft: CheckoutDraft;
  /** Montant en CENTIMES. */
  amount: number;
  buyer: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    zip: string;
    countryCode: string;
  };
}

export interface PayResult {
  /** Commande créée : le checkout vide le panier et affiche le récapitulatif. */
  orderId?: string;
  /** Message à afficher au client. */
  error?: string;
  /** Le PSP a pris la main sur la navigation (3-D Secure, redirection interne). */
  handled?: true;
}

export type ConfirmFn = (ctx: PayContext) => Promise<PayResult>;

/** Props reçues par les champs de saisie d'un PSP. */
export interface FieldsProps {
  /** Clés publiques du PSP (cf. `lib/payments/public-config.ts`). */
  config: Record<string, string | boolean>;
  /** Montant en CENTIMES — pour l'AFFICHAGE uniquement. */
  amount: number;
  /**
   * Lignes du panier. C'est ce qu'on envoie au serveur pour qu'il recalcule le
   * montant à débiter : un total venu du navigateur ne fait jamais foi.
   */
  items: OrderItem[];
  /** Code promo appliqué : les PSP qui figent un montant à l'avance doivent le
   *  connaître, sinon leur jeton porterait le prix non remisé. */
  promoCode?: string;
  /** À appeler dès que le PSP est prêt à encaisser. */
  onReady: (confirm: ConfirmFn) => void;
  /** À appeler si le widget ne peut pas se charger → repli en redirection. */
  onUnavailable: (reason: string) => void;
}

export interface EmbeddedPsp {
  Fields: React.ComponentType<FieldsProps>;
  /** Encadre les champs (bordure + fond), comme Stripe et Fondy. */
  framed?: boolean;
  /**
   * true si `startCheckout` sait basculer sur la page hébergée du PSP quand le
   * widget ne se charge pas. Sinon le client reçoit un message d'indisponibilité
   * honnête, plutôt qu'une promesse de redirection qui n'aboutirait pas.
   */
  hostedFallback?: boolean;
}

export const EMBEDDED_PSP: Record<string, EmbeddedPsp> = {
  stripe: {
    framed: true,
    Fields: ({ config, amount, onReady }) => (
      <StripeCard
        publishableKey={String(config.publishableKey)}
        amount={amount}
        onReady={(confirm) => onReady((ctx) => confirm(ctx.draft))}
      />
    ),
  },

  square: {
    Fields: ({ config, onReady }) => (
      <SquareCard
        applicationId={String(config.applicationId)}
        locationId={String(config.locationId)}
        sandbox={config.sandbox === true}
        onReady={(tokenise) =>
          onReady(async (ctx) => {
            // Tokenisation + 3-D Secure côté Square, puis débit côté serveur.
            const card = await tokenise({
              amount: ctx.amount,
              currency: brand.currency,
              givenName: ctx.buyer.firstName,
              familyName: ctx.buyer.lastName,
              email: ctx.buyer.email,
              addressLines: [ctx.buyer.address],
              city: ctx.buyer.city,
              postalCode: ctx.buyer.zip,
              countryCode: ctx.buyer.countryCode,
            });
            if (card.error || !card.token) {
              return { error: card.error ?? "Veuillez saisir une carte valide." };
            }
            return paySquare({
              token: card.token,
              verificationToken: card.verificationToken,
              draft: ctx.draft,
            });
          })
        }
      />
    ),
  },

  airwallex: {
    framed: true,
    Fields: ({ items, promoCode, onReady, onUnavailable }) => (
      <AirwallexCard
        items={items}
        promoCode={promoCode}
        onUnavailable={onUnavailable}
        onReady={(confirm) => onReady((ctx) => confirm(ctx.draft))}
      />
    ),
  },

  fondy: {
    framed: true,
    hostedFallback: true,
    Fields: ({ config, items, promoCode, onReady, onUnavailable }) => (
      <FondyCard
        merchantId={String(config.merchantId)}
        items={items}
        promoCode={promoCode}
        onUnavailable={onUnavailable}
        onReady={(confirm) =>
          onReady(async (ctx) => {
            // Le widget renvoie lui-même le navigateur sur /api/fondy/return
            // (3-D Secure compris) : on ne reprend la main qu'en cas d'échec.
            const res = await confirm(ctx.draft);
            return res.error ? { error: res.error } : { handled: true };
          })
        }
      />
    ),
  },
};

export const embeddedPsp = (id: string | undefined): EmbeddedPsp | undefined =>
  id ? EMBEDDED_PSP[id] : undefined;
