"use client";

import { brand } from "@/config/brand.config";
import { paySquare } from "@/lib/actions/checkout";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import type { OrderItem } from "@/lib/db/seed";
import SquareCard from "@/components/shop/SquareCard";
import StripeCard from "@/components/shop/StripeCard";
import FondyCard from "@/components/shop/FondyCard";
import WhopCheckout from "@/components/shop/WhopCheckout";
import AirwallexCard from "@/components/shop/AirwallexCard";
import MollieCard from "@/components/shop/MollieCard";
import VivaCard from "@/components/shop/VivaCard";

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
    /** Téléphone du destinataire, tel que saisi. */
    phone: string;
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
  /**
   * Vrai quand les coordonnées de livraison sont complètes.
   *
   * ⚠️ Uniquement utile aux moyens de paiement qui ont LEUR PROPRE bouton
   * (Apple Pay, Google Pay) : ceux-là ouvrent la feuille de paiement sans
   * passer par la validation du formulaire, et doivent donc rester
   * inaccessibles tant qu'on ne sait pas où expédier.
   */
  formValide?: boolean;
  /**
   * Brouillon courant, ou `null` si un champ obligatoire manque.
   *
   * C'est ce qui permet à Apple Pay d'enregistrer EXACTEMENT la même commande
   * qu'un paiement par carte, au lieu de se rabattre sur la fiche du
   * portefeuille — qui ne contient ni l'adresse saisie, ni le bon e-mail.
   */
  getDraft?: () => CheckoutDraft | null;
}

export interface EmbeddedPsp {
  Fields: React.ComponentType<FieldsProps>;
  /** Encadre les champs (bordure + fond), comme Stripe et Fondy. */
  framed?: boolean;
  /**
   * Marque du prestataire qui encaisse, affichée sous les champs.
   *
   * ⚠️ Rendue UNIQUEMENT pour le PSP réellement actif. Viva conditionne
   * l'approbation du compte à la présence de son logo sur les écrans de
   * paiement — mais afficher la marque d'un prestataire qui NE traite PAS le
   * paiement tromperait la cliente sur l'écran où elle saisit sa carte, et
   * signalerait à l'acquéreur un marchand qui appose sa marque sans motif.
   * Le mécanisme reste donc le même pour tous : on nomme qui encaisse, et rien
   * d'autre.
   */
  BrandMark?: React.ComponentType;
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
    Fields: ({ items, promoCode, onReady, onUnavailable, formValide, getDraft }) => (
      <AirwallexCard
        items={items}
        promoCode={promoCode}
        formValide={formValide === true}
        getDraft={getDraft}
        onUnavailable={onUnavailable}
        onReady={(confirm) => onReady((ctx) => confirm(ctx.draft))}
      />
    ),
    /**
     * Airwallex n'impose aucun logo par contrat — d'où une marque TEXTUELLE.
     * Reproduire un logo récupéré sur leur site vitrine, sans en vérifier la
     * licence, serait un risque pris pour rien.
     *
     * Sa raison d'être : la cliente sait qui détient sa carte, et le tunnel
     * porte le nom du prestataire réel quel qu'il soit — ce qui est exactement
     * ce que Viva veut voir, sans rien affirmer de faux.
     */
    BrandMark: () => (
      <p className="mt-3 text-center text-[0.7rem] uppercase tracking-wider text-muted">
        Paiement sécurisé par Airwallex
      </p>
    ),
  },

  mollie: {
    framed: true,
    Fields: ({ config, onReady, onUnavailable }) => (
      <MollieCard
        profileId={String(config.profileId)}
        testmode={config.testmode === true}
        onUnavailable={onUnavailable}
        onReady={(confirm) =>
          onReady(async (ctx) => {
            // Mollie héberge le 3-D Secure : quand il prend la main, on ne
            // vide surtout pas le panier — le sort du paiement se joue sur
            // /api/mollie/return.
            const res = await confirm(ctx.draft);
            if (res.error) return { error: res.error };
            if (res.orderId) return { orderId: res.orderId };
            return { handled: true };
          })
        }
      />
    ),
  },

  /**
   * ⚠️ SEUL PSP du registre dont les champs carte NE SONT PAS dans une iframe :
   * ce sont nos propres `<input>`, lus par le SDK de Viva (cf. VivaCard.tsx).
   * La carte ne touche pas nos serveurs, mais elle passe par notre DOM — la
   * boutique relève donc de SAQ A-EP, et aucun script tiers ne doit être ajouté
   * au tunnel de paiement.
   */
  viva: {
    framed: true,
    /**
     * Condition d'approbation du compte : « viva.com logo is displayed on
     * payment screens ».
     *
     * Servi depuis NOTRE origine, jamais depuis un serveur de Viva : sur cette
     * page le numéro de carte est dans le DOM, et chaque requête sortante y est
     * une surface de plus. C'est aussi la raison du `<img>` brut plutôt que de
     * `next/image`, qui réécrirait l'URL vers un optimiseur distant.
     *
     * L'asset officiel est blanc — d'où le fond sombre, qui reprend la
     * présentation de Viva plutôt que de recolorier leur marque.
     */
    BrandMark: () => (
      <div className="mt-3 flex items-center justify-center gap-2.5 rounded-lg bg-ink px-4 py-2.5">
        {/* ⚠️ `text-white`, et non `text-bg/70` : le jeton `bg` ne supporte pas
            le modificateur d'opacité et retombait sur la couleur héritée —
            du noir sur fond noir, donc un libellé invisible. */}
        <span className="text-[0.7rem] uppercase tracking-wider text-white/70">
          Paiement sécurisé par
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/viva-logo.png"
          alt="viva.com"
          width={300}
          height={52}
          className="h-[1.15rem] w-auto"
        />
      </div>
    ),
    Fields: ({ items, promoCode, onReady, onUnavailable }) => (
      <VivaCard
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

  whop: {
    framed: true,
    // Le prix vient d'une session créée à la volée côté serveur, au montant
    // exact du panier : aucun plan Whop à créer ni à tenir à jour.
    Fields: ({ items, promoCode, formValide, getDraft, onReady, onUnavailable }) => (
      <WhopCheckout
        items={items}
        promoCode={promoCode}
        formValide={formValide === true}
        getDraft={getDraft}
        onUnavailable={onUnavailable}
        onReady={(confirm) => onReady((ctx) => confirm(ctx.draft))}
      />
    ),
  },
};

export const embeddedPsp = (id: string | undefined): EmbeddedPsp | undefined =>
  id ? EMBEDDED_PSP[id] : undefined;
