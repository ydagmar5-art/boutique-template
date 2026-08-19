"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand.config";
import type { OrderItem } from "@/lib/db/seed";
import {
  createFondyToken,
  saveFondyDraft,
  type CheckoutDraft,
} from "@/lib/actions/checkout";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    fondy?: (selector: string, options: Record<string, unknown>) => any;
  }
}

/** Déclenche le paiement avec la carte déjà saisie dans le widget. */
export type FondyConfirm = (draft: CheckoutDraft) => Promise<{ error?: string }>;

const CSS_URL = "https://pay.fondy.eu/latest/checkout.css";
const JS_URL = "https://pay.fondy.eu/latest/checkout.js";
const CONTAINER_ID = "fondy-checkout";

/**
 * Traductions du widget. ⚠️ Le pack de langue `fr` livré par Fondy ne contient
 * que des noms de pays : sans cette surcharge le formulaire s'affiche en
 * anglais (« Card number », « Expiry date »…) sur une boutique française.
 * Les clés sont celles du bundle checkout.js.
 */
const FR = {
  card: "Paiement par carte",
  card_number: "Numéro de carte",
  card_number_p: "1234 1234 1234 1234",
  expiry_date: "Expiration",
  expiry_date_p: "MM/AA",
  cvv2: "CVC",
  cvv2_p: "123",
  cvv2_question: "{0} chiffres au dos de la carte",
  email: "E-mail",
  email_p: "votre adresse e-mail",
  info: "Détail de la commande",
  amount: "Montant :",
  fee: "Frais :",
  methods: "Moyens de paiement",
  methods_m: "Choisissez un moyen de paiement",
  other: "Autres moyens",
  pay: "Payer {0} {1}",
  approved: "Paiement accepté",
  declined: "Paiement refusé",
  pending: "Votre paiement est en cours de traitement",
  number_payment: "N° de paiement {0} :",
  payment_system: "système de paiement",
  continue: "Continuer",
  confirm: "Confirmer",
  cancel: "Annuler",
  back: "Retour",
  submit3ds_title: "Le paiement n'a pas abouti",
  submit3ds_text: "Veuillez réessayer",
  submit3ds_submit: "Relancer le paiement",
  submit3ds_wait: "nouvelle tentative dans {0} s.",
  verification_t: "Vérification de la carte",
  verification_code: "Saisissez le code de vérification",
  verification_amount: "Saisissez le montant de vérification",
};

let sdk: Promise<void> | null = null;

/** Charge checkout.js + sa feuille de style, une seule fois par page. */
function loadFondySdk(): Promise<void> {
  if (sdk) return sdk;
  sdk = new Promise<void>((resolve, reject) => {
    if (window.fondy) return resolve();
    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_URL;
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${JS_URL}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Impossible de charger le paiement Fondy")),
    );
    if (!existing) {
      script.src = JS_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return sdk;
}

/**
 * Le widget expose son état interne sur l'instance Vue renvoyée par `fondy()`.
 * On s'en sert uniquement pour savoir si une requête de paiement est partie —
 * si rien n'est parti après un `submit()`, c'est que la carte saisie n'a pas
 * passé la validation du widget (qui, elle, affiche déjà ses propres messages).
 */
function widgetState(app: any): any {
  return app?.store?.state ?? app?.$root?.store?.state ?? app?.$options?.store?.state;
}

/**
 * Formulaire carte Fondy embarqué : les champs sont rendus DANS la page, le
 * 3-D Secure s'ouvre en fenêtre modale, et la carte part du navigateur droit
 * vers Fondy sans jamais toucher nos serveurs. Le paiement est déclenché par le
 * bouton unique de la page (`onReady`), jamais par un bouton du widget.
 */
export default function FondyCard({
  merchantId,
  items,
  promoCode,
  onReady,
  onUnavailable,
}: {
  merchantId: string;
  /** Lignes du panier : le serveur en déduit le montant figé dans le jeton. */
  items: OrderItem[];
  /** Code promo appliqué : il change le montant à figer. */
  promoCode?: string;
  onReady: (confirm: FondyConfirm) => void;
  onUnavailable: (reason: string) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const appRef = useRef<any>(null);
  const orderRef = useRef("");
  /** Signature stable du panier — voir les dépendances de l'effet plus bas. */
  const cartKey = items
    .map((i) => `${i.slug}:${i.variantId ?? i.variantLabel}:${i.qty}`)
    .join("|") + `#${promoCode ?? ""}`;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const promoRef = useRef(promoCode);
  promoRef.current = promoCode;
  const resolveRef = useRef<((r: { error?: string }) => void) | null>(null);

  const confirm = useCallback<FondyConfirm>(async (draft) => {
    const app = appRef.current;
    if (!app || !orderRef.current) return { error: "Le paiement n'est pas prêt." };

    const saved = await saveFondyDraft(orderRef.current, draft);
    if (saved.error) return { error: saved.error };

    return new Promise<{ error?: string }>((resolve) => {
      resolveRef.current = resolve;
      app.submit();
      // Paiement parti => on laisse la promesse en attente : le widget prend la
      // main (3-D Secure) puis renvoie le navigateur sur /api/fondy/return.
      window.setTimeout(() => {
        if (!resolveRef.current) return;
        const state = widgetState(app);
        if (!state || state.loading) return;
        resolveRef.current = null;
        resolve({
          error:
            state.error?.message ||
            "Vérifiez les informations de votre carte.",
        });
      }, 1500);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        const res = await createFondyToken(itemsRef.current, promoRef.current);
        if (cancelled) return;
        if (res.error || !res.token || !res.orderId) {
          throw new Error(res.error ?? "Fondy indisponible.");
        }
        orderRef.current = res.orderId;

        await loadFondySdk();
        if (cancelled || !window.fondy) return;

        const app = window.fondy(`#${CONTAINER_ID}`, {
          options: {
            methods: ["card"],
            active_tab: "card",
            card_icons: ["mastercard", "visa"],
            full_screen: false,
            // Le bouton « Payer » de la page pilote le widget (app.submit()).
            button: false,
            title: "",
            link: "",
            email: false,
            fields: false,
            fee: false,
            lang: false,
          },
          params: {
            merchant_id: Number(merchantId),
            token: res.token,
            lang: "fr",
          },
          messages: { fr: FR },
          // Le widget Fondy est un iframe : il ne voit pas nos variables CSS,
          // il faut lui passer les couleurs en dur. On les prend donc dans
          // `brand.colors` plutôt que de figer une palette ici — sans ça, le
          // formulaire de paiement garde les teintes de la boutique d'origine.
          css_variable: {
            text: brand.colors.ink,
            bg: brand.colors.bg,
            bg2: brand.colors.surface,
            blue: brand.colors.border,
            red: brand.colors.halo,
            success: brand.colors.primary,
            btn_success: brand.colors.primary,
            danger: brand.colors.secondary,
          },
        });
        if (cancelled) return;
        appRef.current = app;

        app.$on?.("ready", () => !cancelled && setStatus("ready"));
        app.$on?.("error", () => {
          const resolve = resolveRef.current;
          if (!resolve) return;
          resolveRef.current = null;
          resolve({
            error:
              widgetState(app)?.error?.message ||
              "Paiement refusé. Vérifiez votre carte ou essayez-en une autre.",
          });
        });

        setStatus("ready");
        onReady(confirm);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        onUnavailable(e instanceof Error ? e.message : "Fondy indisponible.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        appRef.current?.$destroy?.();
      } catch {
        /* ignore */
      }
      appRef.current = null;
    };
    // `items` est un nouveau tableau à chaque rendu : le mettre en dépendance
    // remonterait le widget (et créerait un jeton) à chaque frappe clavier.
    // On ne réagit qu'à un vrai changement de panier, via sa signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, merchantId]);

  return (
    <div>
      {/* Le widget arrive avec son propre en-tête (gros logo FONDY, nom du
          marchand) et un récapitulatif de commande : on ne garde que les champs
          carte, la page affiche déjà la marque et le détail du panier.
          On masque UNIQUEMENT ces blocs annexes — jamais le conteneur des
          champs, que le widget mesure au montage. */}
      <style>{`
        #${CONTAINER_ID} .f-header,
        #${CONTAINER_ID} .f-info,
        #${CONTAINER_ID} .f-icons { display: none !important; }
        #${CONTAINER_ID} .f-container { border: 0; box-shadow: none; background: transparent; }
        #${CONTAINER_ID} .f-center { padding: 0; }
        /* Le widget centre ses champs dans une colonne de 260 px : on l'étire
           pour aligner la carte sur les champs « Coordonnées » au-dessus. */
        #${CONTAINER_ID} .f-block-sm { width: 100%; max-width: 100%; }
      `}</style>
      <div id={CONTAINER_ID} className="min-h-[120px]" />
      {status === "loading" && (
        <p className="text-xs text-muted">Chargement du paiement sécurisé…</p>
      )}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
        Paiement chiffré par Fondy · vos données carte ne transitent jamais par
        ce site.
      </p>
    </div>
  );
}
