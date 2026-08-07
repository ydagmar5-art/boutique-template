"use client";

import { useEffect, useRef, useState } from "react";
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
  onReady,
  onUnavailable,
}: {
  /** Lignes du panier : le serveur en déduit le montant à débiter. */
  items: OrderItem[];
  /** Code promo appliqué : il change le montant à figer. */
  promoCode?: string;
  onReady: (confirm: AirwallexConfirm) => void;
  onUnavailable: (reason: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let card: CardElement | null = null;

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
        await init({ env: intent.env ?? "demo", enabledElements: ["payments"] });
        if (cancelled) return;

        card = await createElement("card");
        if (cancelled || !box.current || !card) return;
        card.mount(box.current);
        card.on("ready", () => !cancelled && setLoading(false));

        onReady(async (draft) => {
          if (!card) return { error: "Le formulaire de paiement n'est pas prêt." };
          /*
            Nom, téléphone et adresse rattachés à l'intent AVANT la
            confirmation : l'intent a été créé au montage, quand ces champs
            étaient encore vides. Volontairement non bloquant — un refus ici
            ne doit pas empêcher la cliente de payer.
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
    };
    // Le montant est figé à l'ouverture du checkout : le remonter à chaque
    // rendu créerait un PaymentIntent par frappe clavier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Le PaymentIntent fige le montant : appliquer un code promo doit en créer
    // un nouveau, sinon le client paierait le prix non remisé.
  }, [promoCode]);

  return (
    <div>
      {loading && (
        <p className="mb-3 text-xs text-muted">Chargement du paiement sécurisé…</p>
      )}
      <div ref={box} />
    </div>
  );
}
