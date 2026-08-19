"use client";

import { useEffect, useId, useRef, useState } from "react";
import { brand } from "@/config/brand.config";
import { demarrerWhop, payWhop } from "@/lib/actions/checkout";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import type { OrderItem } from "@/lib/db/seed";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  WHOP — checkout embarqué à PRIX DYNAMIQUE                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Whop monte son formulaire de carte dans une iframe : les numéros ne touchent
 * jamais nos serveurs, la boutique reste en PCI DSS SAQ-A.
 *
 * Le montant n'est plus celui d'un plan figé : le serveur crée, pour CETTE
 * commande, une configuration de checkout au prix exact du panier. Remises,
 * offres « 1 acheté 1 offert », plusieurs articles, produits créés dans /admin
 * sans contrepartie Whop — tout passe, sans jamais créer de plan à la main.
 *
 * ⚠️ Le montant est recalculé côté serveur depuis le catalogue. Un total venu
 * du navigateur ne sert qu'à l'affichage.
 *
 * ⚠️ Contrepartie du prix dynamique : sans clé API valide, plus AUCUN paiement
 * ne peut démarrer. On appelle alors `onUnavailable`, et le tunnel bascule sur
 * une autre passerelle plutôt que d'afficher un widget mort.
 */

const LOADER = "https://js.whop.com/static/checkout/loader.js";

declare global {
  interface Window {
    [cle: string]: unknown;
  }
}

export default function WhopCheckout({
  items,
  promoCode,
  formValide,
  getDraft,
  onReady,
  onUnavailable,
}: {
  items: OrderItem[];
  promoCode?: string;
  /** Coordonnées complètes dans le tunnel — condition du montage, voir ci-dessous. */
  formValide?: boolean;
  /** Brouillon saisi dans le tunnel, ou `null` s'il est incomplet. */
  getDraft?: () => CheckoutDraft | null;
  onReady: (
    confirm: (draft: CheckoutDraft) => Promise<{ orderId?: string; error?: string; handled?: true }>,
  ) => void;
  onUnavailable: (raison: string) => void;
}) {
  const brouillon = useRef<CheckoutDraft | null>(null);
  const resoudre = useRef<((r: { orderId?: string; error?: string; handled?: true }) => void) | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [session, setSession] = useState<{ planId: string; sessionId: string } | null>(null);
  const [erreur, setErreur] = useState("");

  const idUnique = useId().replace(/[:]/g, "");
  const idDiv = `whop-${idUnique}`;
  // Signature du panier : une remise appliquée ou une quantité modifiée doit
  // faire refabriquer la session, sinon Whop encaisserait l'ancien montant.
  const empreintePanier = JSON.stringify(items.map((i) => [i.slug, i.variantId, i.qty])) + (promoCode ?? "");

  /*
    Résout la promesse UNE seule fois et coupe la minuterie.
    Sans ça, un rappel Whop qui n'arrive jamais laisse le bouton sur
    « Traitement » indéfiniment : le client ignore s'il a payé et recommence —
    c'est le scénario du double débit.
  */
  const terminer = (r: { orderId?: string; error?: string; handled?: true }) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
    const f = resoudre.current;
    resoudre.current = null;
    f?.(r);
  };

  /**
   * Coordonnées figées au moment où le widget se monte.
   *
   * ⚠️ Les attributs `prefill-*` de Whop sont lus UNE FOIS, à la construction
   * de l'iframe. Les faire suivre la frappe ne servirait à rien — et remonter
   * le widget à chaque caractère créerait un plan Whop par frappe.
   */
  const [identite, setIdentite] = useState<CheckoutDraft | null>(null);

  /* ── 1. Demander au serveur une session au prix du panier ── */
  useEffect(() => {
    let abandonne = false;
    if (!items.length) return;

    /*
      ⚠️ MONTAGE DIFFÉRÉ, et c'est le cœur du réglage.

      Whop redemandait nom et adresse alors que la cliente venait de les saisir
      juste au-dessus : deux fois la même chose sur le même écran. On masque
      donc son formulaire d'adresse (`hide-address`) et on le pré-remplit
      depuis le nôtre.

      Mais les `prefill-*` ne sont lus qu'au montage de l'iframe : il faut donc
      attendre que le tunnel soit rempli avant de la construire. D'où cette
      condition — sans elle on pré-remplirait avec des champs vides, et
      l'adresse étant masquée, la cliente ne pourrait pas corriger.
    */
    const draft = formValide ? getDraft?.() ?? null : null;
    if (!draft) {
      setSession(null);
      setIdentite(null);
      return;
    }
    setIdentite(draft);
    setSession(null);
    /*
      ⚠️ L'E-MAIL EST INDISPENSABLE ICI, il ne sert pas qu'à l'affichage.

      Il part dans les métadonnées de la session Whop, et c'est par lui que le
      webhook rapproche l'encaissement de la commande : l'identifiant de
      PAIEMENT reçu (`pay_…`) n'est pas celui du REÇU stocké dans `pspRef`.
      Tant que la session était créée au montage — donc avant la saisie — cette
      métadonnée partait vide, et chaque vente réussie déclenchait une fausse
      alerte « encaissé sans commande enregistrée ».
    */
    demarrerWhop({
      customer: draft.customer,
      email: draft.email,
      items,
      total: 0, // recalculé côté serveur ; cette valeur n'est jamais utilisée
      promoCode,
    })
      .then((r) => {
        if (abandonne) return;
        if (r.error || !r.planId || !r.sessionId) {
          onUnavailable(r.error ?? "Whop n'a pas pu préparer le paiement.");
          return;
        }
        setSession({ planId: r.planId, sessionId: r.sessionId });
      })
      .catch(() => {
        if (!abandonne) onUnavailable("Whop est injoignable.");
      });
    return () => {
      abandonne = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    /* `formValide` en dépendance, mais PAS le brouillon : on monte au premier
       formulaire complet, puis on n'y revient que si le panier change. Suivre
       chaque correction d'adresse referait une session — donc un plan — à
       chaque frappe. L'adresse qui fait foi pour l'expédition est de toute
       façon celle de la commande, pas celle transmise à Whop. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreintePanier, formValide]);

  /* ── 2. Charger le script et exposer la fonction d'encaissement ── */
  useEffect(() => {
    if (!session) return;

    // Les rappels de Whop se déclarent par NOM sur `window` : l'attribut
    // data-whop-checkout-on-complete porte le nom d'une fonction globale.
    const nomOk = `whopOk_${idUnique}`;
    const nomKo = `whopKo_${idUnique}`;

    window[nomOk] = async (_planId: string, receiptId: string) => {
      const draft = brouillon.current;
      if (!draft) return;
      terminer(await payWhop({ receiptId, planId: session.planId, draft }));
    };
    window[nomKo] = (err: { message?: string }) => {
      const msg = err?.message || "Le paiement n'a pas abouti.";
      setErreur(msg);
      terminer({ error: msg });
    };

    let script = document.querySelector<HTMLScriptElement>(`script[src="${LOADER}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = LOADER;
      script.async = true;
      script.defer = true;
      script.onerror = () => onUnavailable("Le module de paiement Whop n'a pas pu se charger.");
      document.head.appendChild(script);
    }

    onReady(
      (draft) =>
        new Promise((res) => {
          brouillon.current = draft;
          resoudre.current = res;
          const wco = (
            window as unknown as {
              wco?: { submit?: (id: string) => void; setEmail?: (id: string, e: string) => void };
            }
          ).wco;
          if (!wco?.submit) {
            res({ error: "Le module de paiement Whop n'est pas prêt." });
            return;
          }
          // Le champ e-mail de Whop est masqué : il faut lui transmettre
          // l'adresse saisie dans NOTRE formulaire avant de soumettre.
          if (draft.email) wco.setEmail?.(idDiv, draft.email);

          // Garde-fou : plus long qu'un 3-D Secure complet, donc sans risque
          // de couper un paiement légitime.
          minuterie.current = setTimeout(() => {
            terminer({
              error:
                "Nous n'avons pas reçu la confirmation du paiement. Ne recommencez pas : vérifiez votre e-mail, et écrivez-nous si vous avez été débité.",
            });
          }, 180_000);

          wco.submit(idDiv);
        }),
    );

    return () => {
      delete window[nomOk];
      delete window[nomKo];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.planId, session?.sessionId]);

  if (!session) {
    return (
      <p className="py-3 text-sm text-muted">
        {formValide
          ? "Préparation du paiement sécurisé…"
          : "Renseignez vos coordonnées de livraison ci-dessus : le paiement par carte s'affichera ensuite."}
      </p>
    );
  }

  /*
    Le tunnel porte DÉJÀ l'e-mail, le récapitulatif et le bouton de paiement :
    sans ces masquages le client voit deux champs e-mail et deux boutons.
    Le formulaire d'adresse de Whop reste affiché — le masquer obligerait à
    fournir l'adresse par programme, et Whop resterait bloqué sans elle.
    Les conditions de vente de Whop restent visibles : les masquer priverait
    le client d'une information contractuelle.
  */
  return (
    <div>
      <div
        id={idDiv}
        data-whop-checkout-plan-id={session.planId}
        data-whop-checkout-session={session.sessionId}
        data-whop-checkout-theme="light"
        data-whop-checkout-theme-accent-color={brand.colors.primary}
        data-whop-checkout-theme-background-color={brand.colors.surface}
        data-whop-checkout-locale={brand.locale.split("-")[0]}
        data-whop-checkout-skip-redirect="true"
        data-whop-checkout-hide-email="true"
        data-whop-checkout-hide-submit-button="true"
        data-whop-checkout-hide-price="true"
        /* ⚠️ Adresse masquée ET pré-remplie : les deux vont ensemble.
           Masquer sans pré-remplir bloquerait le paiement, pré-remplir sans
           masquer laisserait la cliente ressaisir ce qu'elle vient de taper.
           Attributs relevés dans le bundle officiel de Whop (index.js). */
        data-whop-checkout-hide-address="true"
        data-whop-checkout-prefill-name={identite?.customer ?? ""}
        data-whop-checkout-prefill-email={identite?.email ?? ""}
        /* ⚠️ `line1`, PAS `line` : Whop ignore silencieusement un attribut
           inconnu, et la rue ne partait pas — l'adresse étant masquée, la
           cliente n'aurait eu aucun moyen de la fournir. Vérifié sur l'URL
           réellement construite pour l'iframe. */
        data-whop-checkout-prefill-address-line1={identite?.street ?? ""}
        data-whop-checkout-prefill-address-city={identite?.city ?? ""}
        data-whop-checkout-prefill-address-postal-code={identite?.zip ?? ""}
        data-whop-checkout-prefill-address-country={identite?.country ?? "FR"}
        data-whop-checkout-on-complete={`whopOk_${idUnique}`}
        data-whop-checkout-on-payment-error={`whopKo_${idUnique}`}
      />
      {erreur ? <p className="mt-2 text-sm text-secondary">{erreur}</p> : null}
    </div>
  );
}
