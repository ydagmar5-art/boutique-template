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
  /**
   * Minuterie courte : « l'encaissement n'a même pas démarré ».
   *
   * ⚠️ Elle répond à un comportement MESURÉ de Whop, pas à une supposition :
   * appeler `submit()` sur une carte incomplète — ou après l'annulation d'une
   * feuille Apple Pay — ne produit AUCUN événement. Ni `on-payment-error`, ni
   * `on-state-change`, rien. La promesse restait donc en suspens et le bouton
   * affichait « Paiement en cours… » pendant les trois minutes du garde-fou.
   */
  const minuterieCourte = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Vrai dès que l'iframe a donné signe de vie après un `submit()`. */
  const activite = useRef(false);
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
    if (minuterieCourte.current) clearTimeout(minuterieCourte.current);
    minuterieCourte.current = null;
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

      ⚠️⚠️ PISTE DÉJÀ TENTÉE ET ÉCARTÉE — NE PAS LA REFAIRE.

      Le SDK expose `wco.setEmail()` et `wco.setAddress()`, qui semblent
      permettre de monter l'iframe tout de suite puis d'y pousser l'identité
      juste avant l'encaissement. Essayé, mesuré sur la boutique en
      production : LES DEUX ÉCHOUENT sur « Timeout waiting for embed
      response », y compris `setEmail`, et y compris avec un délai porté à
      huit secondes.

      La cause est structurelle : `hide-email` et `hide-address` font que
      l'iframe ne CONTIENT pas ces champs. Il n'y a donc rien à renseigner, et
      l'embed ne répond jamais à l'événement. Ces deux fonctions ne servent
      qu'aux intégrations qui laissent les champs visibles.

      Conséquence pratique : l'identité ne peut entrer QUE par l'URL de
      l'iframe, donc au montage, donc après la saisie. Le montage différé
      n'est pas un choix de confort, c'est la seule voie tant que les champs
      de Whop sont masqués.

      ⚠️ `setEmail` est appelé plus bas sans `await` : sa promesse est donc
      rejetée en silence. Inoffensif — l'e-mail est déjà passé par
      `prefill-email` — mais ne pas le prendre pour une preuve que ça marche.
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
    const nomEtat = `whopEtat_${idUnique}`;

    /*
      Signal de vie de l'iframe. Le SEUL rôle de ce rappel est de distinguer
      « l'encaissement a démarré » de « il ne s'est rien passé » : dès qu'un
      état remonte, on annule la minuterie courte et on laisse le garde-fou
      long faire son office — un 3-D Secure peut légitimement durer.
    */
    const signalerActivite = () => {
      activite.current = true;
      if (minuterieCourte.current) clearTimeout(minuterieCourte.current);
      minuterieCourte.current = null;
    };

    window[nomEtat] = signalerActivite;

    /*
      ╔══════════════════════════════════════════════════════════════════╗
      ║  SIGNAL DE VIE DE L'IFRAME — NE JAMAIS EN DÉDUIRE UN ÉCHEC       ║
      ╚══════════════════════════════════════════════════════════════════╝

      ⚠️⚠️ ERREUR DÉJÀ COMMISE, QUI A CASSÉ APPLE PAY EN PRODUCTION.

      Une version précédente interprétait le message `close-overlay` comme une
      annulation, et affichait « Paiement interrompu » 2,5 s plus tard. C'est
      FAUX : Whop referme sa surcouche au milieu d'un paiement Apple Pay qui se
      déroule normalement. Le client voyait donc un message d'échec sur un
      paiement en cours, et n'était jamais redirigé vers sa commande.

      ⚠️ RÈGLE : on écoute pour savoir que QUELQUE CHOSE SE PASSE, jamais pour
      conclure que ça a échoué. Seuls `on-complete` et `on-payment-error`, qui
      viennent de Whop, ont le droit de trancher.

      ⚠️ TOUT message de l'iframe compte comme une activité, `resize` et
      `center` compris. C'est délibéré : une feuille Apple Pay peut rester
      ouverte une minute pendant que le client s'authentifie, et la minuterie
      courte ne doit surtout pas se déclencher pendant ce temps. Filtrer plus
      finement, c'est reprendre le risque de couper un paiement en cours.
    */
    const surMessage = (ev: MessageEvent) => {
      const d = ev.data as { __scope?: string } | null;
      if (!d || typeof d !== "object" || d.__scope !== "whop-embedded-checkout") return;
      signalerActivite();
    };
    window.addEventListener("message", surMessage);

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

          /*
            ⚠️ MINUTERIE COURTE — rend la main quand Whop n'a rien démarré.

            Quinze secondes sans le moindre signe de l'iframe : le paiement
            n'est pas parti. Mesuré sur la boutique — carte incomplète ou
            feuille Apple Pay refusée, `submit()` reste muet.

            ⚠️ Ce n'est PAS un délai d'attente de paiement. Le moindre état
            remonté par l'iframe l'annule (voir `nomEtat`), et c'est le
            garde-fou de trois minutes qui prend alors le relais. Sans cette
            distinction, on rendrait la main pendant un 3-D Secure en cours et
            un second clic pourrait débiter deux fois.

            ⚠️ Le message ne dit PAS « échec » : rien ne prouve un refus
            bancaire, le plus souvent la carte est simplement incomplète.

            ⚠️ 45 SECONDES, ET PAS MOINS. Une feuille Apple Pay reste ouverte
            le temps que le client choisisse sa carte et s'authentifie — bien
            plus longtemps qu'on ne l'imagine depuis un bureau. La minuterie
            est de toute façon annulée au premier message de l'iframe, donc
            elle ne se déclenche QUE si Whop n'a strictement rien fait.
          */
          activite.current = false;
          minuterieCourte.current = setTimeout(() => {
            if (activite.current) return;
            terminer({
              error:
                "Le paiement n'a pas démarré. Vérifiez que le numéro de carte, la date et le cryptogramme sont bien renseignés, puis réessayez — vous n'avez pas été débité.",
            });
          }, 45_000);

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
      window.removeEventListener("message", surMessage);
      delete window[nomOk];
      delete window[nomKo];
      delete window[nomEtat];
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
    /*
      ⚠️ `overflow-x-hidden` + `max-w-full` : l'iframe de Whop dimensionne son
      contenu elle-même et déborde sur les écrans étroits, ce qui rendait TOUTE
      la page de paiement glissante de gauche à droite.

      ⚠️ Le confinement se fait ICI et pas sur `body` : la fiche produit et la
      barre d'achat reposent sur `position: sticky`, qu'un `overflow` posé sur
      un ancêtre neutralise silencieusement.
    */
    <div className="w-full max-w-full overflow-x-hidden [&_iframe]:max-w-full">
      <div
        id={idDiv}
        className="w-full max-w-full"
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
        /* Signal de vie : distingue « rien n'a démarré » d'un paiement en
           cours. Sans lui, la minuterie courte couperait un 3-D Secure. */
        data-whop-checkout-on-state-change={`whopEtat_${idUnique}`}
      />
      {erreur ? <p className="mt-2 text-sm text-secondary">{erreur}</p> : null}
    </div>
  );
}
