"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderItem } from "@/lib/db/seed";
import {
  createVivaPayment,
  payViva,
  saveVivaDraft,
  type CheckoutDraft,
} from "@/lib/actions/checkout";

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  VIVA.COM — NATIVE CHECKOUT v2                                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ LES CHAMPS CI-DESSOUS SONT DE VRAIS `<input>` DE NOTRE PAGE.
 *
 * Contrairement à Stripe, Square ou Airwallex, Viva n'encadre rien dans une
 * iframe : son SDK repère nos champs par leur attribut `data-vp`, lit leur
 * valeur et l'envoie lui-même à `/nativecheckout/v2/chargetokens`.
 *
 * Ce que cela impose, et qui n'est pas négociable :
 *
 *  · `autoComplete="off"` et `name` absent : sans cela le navigateur, un
 *    gestionnaire de mots de passe ou une extension archiveraient le PAN.
 *    Le SDK retire d'ailleurs lui-même l'attribut `name` au moment d'envoyer.
 *  · AUCUN script tiers sur cette page — ni pixel, ni tag manager, ni outil
 *    d'analyse. N'importe lequel pourrait lire ces champs.
 *  · Les valeurs ne sont JAMAIS mises dans un état React, ni journalisées, ni
 *    transmises à nos actions serveur. Elles restent dans le DOM, le temps que
 *    le SDK les échange contre un jeton à usage unique.
 *
 * Le 3-D Secure s'affiche dans une iframe que le SDK injecte lui-même dans le
 * conteneur prévu plus bas.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    /** Dépendance du SDK Viva — voir `chargerSdk`. Servie depuis notre paquet. */
    jQuery?: any;
    $?: any;
    VivaPayments?: {
      cards?: {
        setup: (options: Record<string, unknown>) => void;
        requestToken: (options: { amount: number }) => {
          done: (cb: (res: { chargeToken?: string }) => void) => any;
          fail: (cb: (err: any) => void) => any;
        };
      };
    };
  }
}

export type VivaConfirm = (draft: CheckoutDraft) => Promise<{
  orderId?: string;
  error?: string;
}>;

/** Conteneur du 3-D Secure. Le SDK y injecte son iframe par cet identifiant. */
const TDS_ID = "viva-3ds";

let sdkCharge: Promise<void> | null = null;

/**
 * Charge le SDK Viva une seule fois par page.
 *
 * ⚠️ jQUERY EST OBLIGATOIRE, ET SON ABSENCE NE PRODUIT AUCUNE ERREUR.
 * Le SDK Native Checkout v2 s'appuie sur `$.ajax` et `$.Deferred`. S'il ne
 * trouve pas `window.jQuery` à son exécution, il s'installe quand même —
 * mais en laissant un objet `VivaPayments` VIDE, sans `cards`. Le script
 * répond `onload`, la console reste muette, et le paiement échoue sans
 * explication. Vérifié : 0 clé sans jQuery, 9 clés avec.
 *
 * ⚠️ jQuery est SERVI DEPUIS NOTRE PAQUET, jamais depuis un CDN public. La
 * page porte le numéro de carte dans son DOM (cf. en-tête de ce fichier) :
 * un script tiers y aurait accès, et une compromission de CDN suffirait à
 * siphonner les cartes. C'est le scénario que le périmètre SAQ A-EP impose
 * précisément d'écarter, et l'exigence 6.4.3 du PCI DSS v4 de documenter.
 */
async function chargerSdk(url: string): Promise<void> {
  if (sdkCharge) return sdkCharge;
  sdkCharge = (async () => {
    if (!window.jQuery) {
      const jq = (await import("jquery")).default;
      // Le SDK lit ces deux globales au moment où il s'évalue : elles doivent
      // exister AVANT l'insertion de sa balise, pas après.
      window.jQuery = jq;
      window.$ = jq;
    }
    await new Promise<void>((resolve, reject) => {
      if (window.VivaPayments?.cards) return resolve();
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () =>
        window.VivaPayments?.cards
          ? resolve()
          : // Filet explicite : plutôt qu'un formulaire inerte, on bascule sur
            // le message d'indisponibilité du checkout.
            reject(new Error("SDK Viva chargé mais inutilisable"));
      s.onerror = () => reject(new Error("SDK Viva injoignable"));
      document.head.appendChild(s);
    });
  })().catch((e) => {
    // Réarmer : un échec réseau ponctuel ne doit pas condamner la page entière,
    // la cliente peut vouloir réessayer.
    sdkCharge = null;
    throw e;
  });
  return sdkCharge;
}

/** Formate la saisie en `MM/AA` pendant la frappe, sans jamais bloquer. */
function formaterExpiration(v: string): string {
  const chiffres = v.replace(/\D/g, "").slice(0, 4);
  if (chiffres.length <= 2) return chiffres;
  return `${chiffres.slice(0, 2)}/${chiffres.slice(2)}`;
}

/** Groupe le numéro par quatre — confort de relecture, aucun contrôle métier. */
function formaterNumero(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export default function VivaCard({
  items,
  promoCode,
  onReady,
  onUnavailable,
}: {
  items: OrderItem[];
  promoCode?: string;
  onReady: (confirm: VivaConfirm) => void;
  onUnavailable: (reason: string) => void;
}) {
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState("");
  const [auth3ds, setAuth3ds] = useState(false);

  /* Réfs plutôt qu'états : le contenu de ces champs ne doit jamais entrer dans
     le cycle de rendu de React, où il finirait dans les outils de développement
     et, potentiellement, dans un rapport d'erreur. */
  const refPaiementRef = useRef<string>("");
  const montantRef = useRef<number>(0);

  // `onReady` change à chaque rendu du parent : le figer évite de remonter
  // l'ordre — et donc d'en créer un nouveau — à chaque frappe dans le formulaire.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const confirmer = useCallback<VivaConfirm>(async (draft) => {
    const ref = refPaiementRef.current;
    const cards = window.VivaPayments?.cards;
    if (!ref || !cards) {
      return { error: "Le formulaire de paiement n'est pas prêt." };
    }

    // Coordonnées mises à l'abri AVANT le débit : si le navigateur ne revient
    // pas, le webhook saura à qui expédier.
    await saveVivaDraft(ref, draft).catch(() => ({ ok: false }));

    setErreur("");
    setAuth3ds(true);

    const jeton = await new Promise<{
      chargeToken?: string;
      error?: string;
      /** Vrai quand l'échec ne vient PAS de la carte — voir plus bas. */
      indisponible?: boolean;
    }>((resolve) => {
      try {
        cards
          .requestToken({ amount: montantRef.current })
          .done((res) =>
            resolve(
              res?.chargeToken
                ? { chargeToken: res.chargeToken }
                : { error: "La carte n'a pas pu être validée." },
            ),
          )
          /**
           * ⚠️ NE JAMAIS ACCUSER LA CARTE PAR DÉFAUT.
           *
           * Un `401`/`403` sur la tokenisation signifie que Native Checkout v2
           * n'est pas ouvert sur le compte marchand, ou que les clés sont
           * refusées — la carte de la cliente n'y est pour rien. Lui dire
           * « carte refusée » l'envoie en essayer une deuxième, puis une
           * troisième, et lui laisse croire que sa banque la bloque. C'est
           * exactement ce que faisait la version précédente.
           */
          .fail((err: any) => {
            const statut = Number(err?.status ?? 0);
            if (statut === 401 || statut === 403) {
              console.error("[viva] tokenisation interdite", statut, err?.responseText);
              resolve({
                indisponible: true,
                error:
                  "Le paiement par carte est momentanément indisponible. " +
                  "Votre carte n'a pas été débitée.",
              });
              return;
            }
            const detail = String(err?.responseText ?? err?.message ?? "");
            resolve({
              error: /card|number|expir|cvc|holder/i.test(detail)
                ? "Vérifiez le numéro, la date d'expiration et le cryptogramme."
                : "La carte a été refusée. Essayez une autre carte.",
            });
          });
      } catch {
        resolve({ error: "La carte n'a pas pu être validée." });
      }
    });

    setAuth3ds(false);

    if (jeton.indisponible) {
      // Le checkout bascule sur son message d'indisponibilité : inutile de
      // laisser la cliente s'acharner sur un formulaire qui ne peut pas aboutir.
      onUnavailableRef.current("Tokenisation Viva refusée.");
      setErreur(jeton.error ?? "");
      return { error: jeton.error };
    }

    if (jeton.error || !jeton.chargeToken) {
      const msg = jeton.error ?? "La carte n'a pas pu être validée.";
      setErreur(msg);
      return { error: msg };
    }

    // Le débit se fait côté serveur : le navigateur ne transmet qu'un jeton à
    // usage unique, jamais un montant.
    const res = await payViva({
      ref,
      chargeToken: jeton.chargeToken,
      draft,
    });

    if (res.error) {
      setErreur(res.error);
      /* Un ordre Viva ne vaut que pour UN paiement : après un refus, il faut en
         créer un nouveau, sinon la seconde tentative serait rejetée sans que la
         cliente comprenne pourquoi. */
      refPaiementRef.current = "";
      void preparer();
    }
    return res;
  }, []);

  const preparer = useCallback(async () => {
    const res = await createVivaPayment(items, promoCode);
    if (res.error || !res.ref || !res.accessToken || !res.sdkUrl) {
      onUnavailableRef.current(res.error ?? "Viva indisponible.");
      return;
    }
    try {
      await chargerSdk(res.sdkUrl);
      // `chargerSdk` ne rend la main que si `cards` existe : l'absence ici
      // serait un bug, pas un cas d'exécution.
      window.VivaPayments!.cards!.setup({
        authToken: res.accessToken,
        baseURL: res.baseUrl,
        amount: res.amount,
        cardHolderAuthOptions: { cardHolderAuthPlaceholderId: TDS_ID },
      });
    } catch {
      onUnavailableRef.current("Le formulaire de paiement n'a pas pu se charger.");
      return;
    }
    refPaiementRef.current = res.ref;
    montantRef.current = res.amount ?? 0;
    setPret(true);
    onReadyRef.current(confirmer);
  }, [items, promoCode, confirmer]);

  useEffect(() => {
    void preparer();
    // Volontairement monté une seule fois : recréer un ordre à chaque
    // changement du panier laisserait derrière lui des ordres orphelins chez
    // Viva. Le montant qui fait foi est de toute façon recalculé au débit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const champ =
    "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50";

  return (
    <div>
      {!pret && <p className="py-6 text-sm text-muted">Chargement du paiement…</p>}

      <div className={pret ? "space-y-3" : "hidden"}>
        <div>
          <label htmlFor="viva-cardnumber" className="text-xs font-medium text-muted">
            Numéro de carte
          </label>
          <input
            id="viva-cardnumber"
            data-vp="cardnumber"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234 1234 1234 1234"
            disabled={auth3ds}
            onChange={(e) => {
              e.target.value = formaterNumero(e.target.value);
            }}
            className={`${champ} mt-1 font-mono tracking-wider`}
          />
        </div>

        <div>
          <label htmlFor="viva-cardholder" className="text-xs font-medium text-muted">
            Titulaire de la carte
          </label>
          <input
            id="viva-cardholder"
            data-vp="cardholder"
            autoComplete="off"
            placeholder="Tel qu'inscrit sur la carte"
            disabled={auth3ds}
            className={`${champ} mt-1`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="viva-expdate" className="text-xs font-medium text-muted">
              Expiration
            </label>
            <input
              id="viva-expdate"
              data-vp="expdate"
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/AA"
              disabled={auth3ds}
              onChange={(e) => {
                e.target.value = formaterExpiration(e.target.value);
              }}
              className={`${champ} mt-1 font-mono`}
            />
          </div>
          <div>
            <label htmlFor="viva-cvv" className="text-xs font-medium text-muted">
              Cryptogramme
            </label>
            <input
              id="viva-cvv"
              data-vp="cvv"
              inputMode="numeric"
              autoComplete="off"
              placeholder="123"
              disabled={auth3ds}
              onChange={(e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
              }}
              className={`${champ} mt-1 font-mono`}
            />
          </div>
        </div>
      </div>

      {/* Conteneur du 3-D Secure. Il doit exister AVANT l'appel à `setup`, et
          rester monté : le SDK y injecte son iframe et attend la réponse de la
          banque par `postMessage`. Sans hauteur quand il est inactif, il ne
          décale pas la mise en page. */}
      <div
        id={TDS_ID}
        className={auth3ds ? "mt-4 h-[26rem] w-full" : "h-0 overflow-hidden"}
      />

      {auth3ds && (
        <p className="mt-2 text-xs text-muted">
          Validation auprès de votre banque en cours. Ne fermez pas cette page.
        </p>
      )}

      {erreur && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
    </div>
  );
}
