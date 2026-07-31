"use client";

// "/pure" est OBLIGATOIRE ici : l'entrée normale de @stripe/stripe-js charge
// Stripe.js dès l'IMPORT du module, ce qui l'embarquerait sur toutes les pages
// du site (poids inutile + cookies de détection de fraude partout).
import { loadStripe, type Stripe } from "@stripe/stripe-js";

let cached: Promise<Stripe | null> | null = null;

/**
 * Charge Stripe.js UNE SEULE FOIS par page et garde la promesse en cache.
 * Appelée tôt (dès que le panier se remplit), elle rend le montage du
 * formulaire de paiement quasi instantané une fois sur le checkout.
 *
 * Passe par le SDK plutôt que par un <link rel="preload"> : l'URL réelle
 * (…/dahlia/stripe.js) dépend de la version du paquet et changerait sans
 * prévenir.
 */
export function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!cached) cached = loadStripe(publishableKey);
  return cached;
}
