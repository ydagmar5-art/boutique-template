"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/store";

/**
 * Précharge Stripe.js dès que le panier n'est plus vide, pendant que le client
 * continue sa visite : sans ça, le téléchargement ne démarre qu'au montage du
 * formulaire, d'où 1 à 2 secondes d'attente sur le checkout.
 *
 * ⚠️ L'import est DYNAMIQUE à dessein : `@stripe/stripe-js` déclenche le
 * chargement de Stripe.js dès que son module est évalué. Un import statique
 * ici — ce composant vit dans le layout — embarquerait Stripe sur toutes les
 * pages du site (poids inutile + cookies de détection de fraude partout).
 */
export default function StripePreload({
  publishableKey,
}: {
  publishableKey: string;
}) {
  const count = useCart((s) => s.lines.length);

  useEffect(() => {
    if (count === 0) return;
    let annule = false;
    import("@/lib/stripe-client").then((m) => {
      if (!annule) void m.getStripe(publishableKey);
    });
    return () => {
      annule = true;
    };
  }, [count, publishableKey]);

  return null;
}
