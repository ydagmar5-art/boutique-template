"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import {
  attachAirwallexIdentity,
  createAirwallexIntent,
  finalizeAirwallexPayment,
} from "@/lib/actions/checkout";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import type { OrderItem } from "@/lib/db/seed";

export type AirwallexConfirm = (
  draft: CheckoutDraft,
) => Promise<{ orderId?: string; error?: string }>;

/**
 * Pays du marchand, déduit de la locale de la boutique.
 * Apple l'exige pour composer la feuille de paiement ; une valeur fausse fait
 * échouer la session avant même l'affichage du bouton.
 */
const PAYS = (brand.locale.split("-")[1] || "FR").toUpperCase();

/**
 * Langue des libellés Airwallex (champs carte, messages d'erreur).
 *
 * ⚠️ Sans ce réglage, le SDK suit la langue du NAVIGATEUR : une boutique
 * française affichait « Card number » et des messages d'erreur en anglais à
 * toute visiteuse dont le téléphone n'est pas en français.
 *
 * Restreint à la liste réellement supportée par le SDK : une valeur inconnue
 * y est ignorée en silence et ramène l'anglais.
 */
const LANGUES = ["en", "zh", "ja", "ko", "ar", "fr", "es", "nl", "de", "it", "pl", "fi", "ru", "da", "id", "ms", "sv", "pt", "ro"] as const;
const langue = brand.locale.split("-")[0].toLowerCase();
const LANGUE = (LANGUES as readonly string[]).includes(langue) ? langue : "en";

/** Élément carte du SDK, tel que typé par `@airwallex/components-sdk`. */
type CardElement = Awaited<
  ReturnType<typeof import("@airwallex/components-sdk").createElement<"card">>
>;

/**
 * Champs carte Airwallex embarqués (Card Element).
 *
 * On utilise le Card Element plutôt que le Drop-in : le Drop-in apporte son
 * propre bouton de paiement, alors que le tunnel n'en a qu'un seul, en bas de
 * page. Ici c'est notre bouton qui déclenche `confirm()`, comme pour Stripe et
 * Square. Le 3-D Secure s'affiche en surcouche Airwallex, sans quitter le site.
 *
 * Le PaymentIntent est créé dès le montage : le Card Element a besoin de son
 * `id` et de son `client_secret`, qui ne valent que pour ce paiement. Les clés
 * API, elles, ne quittent jamais le serveur.
 */
export default function AirwallexCard({
  items,
  promoCode,
  formValide,
  getDraft,
  onReady,
  onUnavailable,
}: {
  /** Lignes du panier : le serveur en déduit le montant à débiter. */
  items: OrderItem[];
  /** Code promo appliqué : il change le montant à figer. */
  promoCode?: string;
  /** Coordonnées de livraison complètes — verrou du bouton Apple Pay. */
  formValide?: boolean;
  /** Brouillon saisi dans le tunnel, ou `null` s'il est incomplet. */
  getDraft?: () => CheckoutDraft | null;
  onReady: (confirm: AirwallexConfirm) => void;
  onUnavailable: (reason: string) => void;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const walletBox = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(false);
  const [walletErreur, setWalletErreur] = useState("");

  /* Le brouillon change à chaque frappe : on le lit au moment du paiement via
     une réf, plutôt que de remonter l'élément Apple Pay — ce qui recréerait un
     PaymentIntent à chaque caractère saisi. */
  const getDraftRef = useRef(getDraft);
  getDraftRef.current = getDraft;

  useEffect(() => {
    let cancelled = false;
    let card: CardElement | null = null;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let applePay: any = null;

    (async () => {
      const intent = await createAirwallexIntent(items, promoCode);
      if (cancelled) return;
      if (intent.error || !intent.intentId || !intent.clientSecret) {
        onUnavailable(intent.error ?? "Airwallex indisponible.");
        return;
      }
      const intentId = intent.intentId;
      const clientSecret = intent.clientSecret;

      try {
        const { init, createElement } = await import("@airwallex/components-sdk");
        await init({
          env: intent.env ?? "demo",
          enabledElements: ["payments"],
          // Sans ça, les champs carte suivent la langue du téléphone.
          locale: LANGUE as "fr",
        });
        if (cancelled) return;

        card = await createElement("card");
        if (cancelled || !box.current || !card) return;
        card.mount(box.current);
        card.on("ready", () => !cancelled && setLoading(false));

        /* ─────────────────────── Apple Pay ───────────────────────
           Élément SÉPARÉ du champ carte, et volontairement placé au-dessus :
           sur iPhone, c'est le chemin le plus court vers l'achat.

           ⚠️ Il s'affiche uniquement si l'appareil le permet ET si le domaine
           est vérifié chez Apple via Airwallex. Toute erreur est donc avalée
           en silence : sur un ordinateur ou un Android, l'absence du bouton
           est le comportement NORMAL, pas une panne à signaler.

           ⚠️ Ce bouton a son PROPRE déclencheur : il ouvre la feuille de
           paiement sans passer par le bouton « Payer » ni par la validation du
           formulaire. Il reste donc verrouillé tant que les coordonnées de
           livraison sont incomplètes (`formValide`), et la commande est bâtie
           sur le brouillon du TUNNEL — jamais sur la fiche du portefeuille,
           qui ne porte que l'adresse de facturation de la carte. */
        /* ⚠️ Test d'Apple AVANT toute création d'élément.
           L'événement `ready` du SDK se déclenche même là où Apple Pay est
           indisponible : sur Chrome, le séparateur « ou payer par carte »
           s'affichait au-dessus du vide. `ApplePaySession` n'existe que sur
           les navigateurs Apple, et `canMakePayments()` confirme que
           l'appareil sait présenter la feuille de paiement. */
        const apple = (window as unknown as {
          ApplePaySession?: { canMakePayments?: () => boolean };
        }).ApplePaySession;
        const applePossible = Boolean(apple?.canMakePayments?.());

        try {
          if (!applePossible) throw new Error("Apple Pay indisponible sur cet appareil");
          applePay = await createElement("applePayButton", {
            intent_id: intentId,
            client_secret: clientSecret,
            mode: "payment",
            /* ⚠️ Unités MAJEURES ici (69.00), alors que la boutique compte en
               centimes : Apple afficherait sinon « 6 900 € » sur la feuille de
               paiement. Le montant vient du SERVEUR, jamais d'un total
               recalculé dans le navigateur. */
            amount: { value: (intent.amount ?? 0) / 100, currency: brand.currency },
            countryCode: PAYS,
            totalPriceLabel: brand.name,
            /* Facturation seulement : elle sert au contrôle du risque et aux
               litiges côté Airwallex. On NE demande PAS l'adresse de livraison
               à Apple — la cliente vient de la saisir dans le tunnel, et la
               redemander ajouterait une étape pour une donnée déjà connue. */
            requiredBillingContactFields: ["postalAddress", "name"],
            /**
             * ⚠️ `plain` — la marque Apple Pay SEULE, sans aucun mot.
             *
             * Le libellé d'un bouton `buy` est composé par Apple d'après la
             * langue du NAVIGATEUR, et le SDK n'expose aucune locale pour le
             * forcer : une visiteuse dont le téléphone est en anglais lisait
             * « Buy with Apple Pay » sur une boutique française. `plain` ne
             * contient pas de texte, il est donc juste dans toutes les langues.
             */
            buttonType: "plain",
            buttonColor: "black",
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          } as any);

          if (!cancelled && applePay && walletBox.current) {
            applePay.mount(walletBox.current);
            applePay.on("ready", () => !cancelled && setWallet(true));
            applePay.on("error", () => !cancelled && setWallet(false));
            applePay.on("success", async () => {
              if (cancelled) return;

              /**
               * ⚠️ LES COORDONNÉES VIENNENT DU FORMULAIRE, PAS DE LA FICHE
               * APPLE.
               *
               * La fiche du portefeuille ne contient que l'adresse de
               * FACTURATION de la carte : ni l'adresse de livraison saisie
               * plus haut, ni l'e-mail donné à la boutique. Une commande bâtie
               * dessus arrivait sans destinataire et sans adresse — c'est
               * exactement ce qui s'est produit en test.
               *
               * Le brouillon est donc celui du tunnel, identique en tout point
               * à un paiement par carte.
               */
              const draft = getDraftRef.current?.() ?? null;
              if (!draft) {
                setWalletErreur(
                  "Le paiement a abouti mais vos coordonnées manquent. Écrivez-moi, je finalise la commande à la main.",
                );
                return;
              }

              // Identité rattachée à l'intent AVANT l'enregistrement : c'est
              // elle qui servira au dossier en cas de litige.
              await attachAirwallexIdentity(intentId, draft).catch(() => ({ ok: false }));

              // Le succès vient du navigateur : le serveur relit l'intent chez
              // Airwallex, et c'est lui qui décide s'il y a commande.
              const res = await finalizeAirwallexPayment({ intentId, draft });
              if (res.orderId) {
                router.push(`/order/${res.orderId}`);
              } else {
                setWalletErreur(
                  res.error ??
                    "Le paiement a abouti mais la commande n'a pas pu être enregistrée. Écrivez-moi.",
                );
              }
            });
          }
        } catch {
          // Apple Pay indisponible : le formulaire carte reste entier.
        }

        onReady(async (draft) => {
          if (!card) return { error: "Le formulaire de paiement n'est pas prêt." };
          /*
            Nom, téléphone et adresse rattachés à l'intent AVANT la
            confirmation : l'intent a été créé au montage, quand ces champs
            étaient encore vides. Airwallex s'en sert pour son contrôle du
            risque et pour les dossiers de litige.
            Volontairement non bloquant — un refus ici ne doit pas empêcher
            la cliente de payer (l'action renvoie `ok: false`, jamais un jet).
          */
          await attachAirwallexIdentity(intentId, draft);
          try {
            // Le 3-D Secure se joue ici, en surcouche Airwallex.
            await card.confirm({ client_secret: clientSecret });
          } catch (e) {
            const detail = (e as { message?: string })?.message;
            return { error: detail ?? "Le paiement a été refusé." };
          }
          // Le succès annoncé par le SDK vient du navigateur : c'est le serveur
          // qui relit l'intent chez Airwallex avant de créer la commande.
          return finalizeAirwallexPayment({ intentId, draft });
        });
      } catch (e) {
        if (!cancelled) {
          onUnavailable(e instanceof Error ? e.message : "Airwallex indisponible.");
        }
      }
    })();

    return () => {
      cancelled = true;
      card?.unmount?.();
      // Sans ce démontage, appliquer un code promo laisserait un bouton Apple
      // Pay rattaché à l'ANCIEN intent : la cliente paierait le prix non remisé.
      applePay?.unmount?.();
    };
    // Le montant est figé à l'ouverture du checkout : le remonter à chaque
    // rendu créerait un PaymentIntent par frappe clavier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Le PaymentIntent fige le montant : appliquer un code promo doit en créer
    // un nouveau, sinon le client paierait le prix non remisé.
  }, [promoCode]);

  return (
    <div>
      {/* Apple Pay — au-dessus du champ carte : sur iPhone c'est le chemin le
          plus court vers l'achat. Le conteneur reste monté même invisible,
          car le SDK a besoin d'une cible avant de savoir si l'appareil est
          compatible. `wallet` ne passe à vrai qu'à l'événement `ready`. */}
      <div className={wallet ? "mb-4" : "sr-only"}>
        {/* ⚠️ Verrou : tant que les coordonnées de livraison sont incomplètes,
            le bouton est masqué ET rendu inatteignable au clavier comme au
            doigt. Apple Pay ouvre sa feuille en un appui, sans passer par la
            validation du formulaire — un encaissement partirait alors sans
            qu'on sache où expédier. */}
        <div
          ref={walletBox}
          aria-hidden={!formValide}
          className={
            formValide ? "" : "pointer-events-none h-0 overflow-hidden opacity-0"
          }
        />
        {wallet && !formValide && (
          <p className="rounded-xl border border-line bg-bg px-4 py-3 text-xs text-muted">
            Renseignez vos coordonnées de livraison ci-dessus pour payer avec
            Apple&nbsp;Pay.
          </p>
        )}
        {wallet && formValide && (
          <div className="mt-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[0.7rem] uppercase tracking-wider text-muted">
              ou payer par carte
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        )}
      </div>

      {walletErreur && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {walletErreur}
        </p>
      )}

      {loading && (
        <p className="mb-3 text-xs text-muted">Chargement du paiement sécurisé…</p>
      )}
      <div ref={box} />
    </div>
  );
}
