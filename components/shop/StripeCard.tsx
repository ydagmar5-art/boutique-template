"use client";

import { useMemo } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { brand } from "@/config/brand.config";
import { createStripeIntent, finalizeStripePayment } from "@/lib/actions/checkout";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import { getStripe } from "@/lib/stripe-client";

export type StripeConfirm = (
  draft: CheckoutDraft,
) => Promise<{ orderId?: string; error?: string }>;

/**
 * Champs carte Stripe (Payment Element) affichés DÈS l'arrivée sur la page.
 * Elements est monté en « mode différé » : il ne connaît que le montant, et le
 * PaymentIntent n'est créé qu'au moment où le client valide — c'est ce qui
 * permet d'afficher les champs sans rien demander au préalable.
 */
export default function StripeCard({
  publishableKey,
  amount,
  onReady,
}: {
  publishableKey: string;
  /** Montant en centimes. */
  amount: number;
  onReady: (confirm: StripeConfirm) => void;
}) {
  // Promesse partagée : si StripePreload a déjà chargé Stripe.js pendant que
  // le client remplissait son panier, le montage est immédiat.
  const stripePromise = useMemo(
    () => getStripe(publishableKey),
    [publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount,
        currency: brand.currency.toLowerCase(),
        locale: "fr",
        // Champs accordés au design de la marque plutôt qu'au bleu Stripe par défaut.
        appearance: {
          variables: {
            colorPrimary: "#D9954B",
            colorText: "#2A2420",
            colorDanger: "#BE6A47",
            fontFamily: "system-ui, sans-serif",
            borderRadius: "12px",
            spacingUnit: "4px",
          },
        },
      }}
    >
      {/* Ne RIEN superposer ni masquer autour du PaymentElement : tout
          habillage (display:none, overlay) casse son rendu — il s'initialise
          alors dans un conteneur mal dimensionné et reste vide. Le confort de
          chargement vient du préchargement (StripePreload), pas d'un squelette. */}
      <PaymentForm onReady={onReady} />
    </Elements>
  );
}

/** Enfant d'<Elements> : c'est le seul endroit où useStripe/useElements marchent. */
function PaymentForm({ onReady }: { onReady: (confirm: StripeConfirm) => void }) {
  const stripe = useStripe();
  const elements = useElements();

  const confirm: StripeConfirm = async (draft) => {
    if (!stripe || !elements) return { error: "Paiement non disponible." };

    // 1. Valide les champs carte côté client (obligatoire en mode différé).
    const submitted = await elements.submit();
    if (submitted.error) {
      return { error: submitted.error.message ?? "Carte invalide." };
    }

    // 2. Crée le PaymentIntent maintenant que la commande est complète.
    const intent = await createStripeIntent(draft);
    if (intent.error || !intent.clientSecret) {
      return { error: intent.error ?? "Paiement indisponible." };
    }

    // 3. Confirme. `redirect: "if_required"` garde le client sur le site sauf
    //    si sa banque impose un 3-D Secure.
    const result = await stripe.confirmPayment({
      elements,
      clientSecret: intent.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
      redirect: "if_required",
    });
    if (result.error) {
      return { error: result.error.message ?? "Le paiement a été refusé." };
    }
    if (result.paymentIntent?.status !== "succeeded") {
      return { error: "Paiement non confirmé. Aucun débit n'a eu lieu." };
    }

    // 4. Vérifié côté serveur, puis commande créée.
    return finalizeStripePayment(result.paymentIntent.id);
  };

  // Le parent déclenche la confirmation depuis son bouton « Payer ».
  onReady(confirm);

  return <PaymentElement options={{ layout: "tabs" }} />;
}
