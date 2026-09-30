import type { OrderTracking } from "@/lib/db/seed";

/**
 * Transporteurs proposés à l'expédition. `track` est le préfixe de l'URL de
 * suivi public : on y concatène le numéro pour composer le lien envoyé au
 * client. « Autre » n'a pas de lien — seul le numéro est affiché.
 */
export const CARRIERS: { id: string; label: string; track?: string }[] = [
  {
    id: "dhl",
    label: "DHL",
    track: "https://www.dhl.com/fr-fr/home/tracking/tracking-express.html?submit=1&tracking-id=",
  },
  {
    id: "colissimo",
    label: "Colissimo",
    track: "https://www.laposte.fr/outils/suivre-vos-envois?code=",
  },
  {
    id: "chronopost",
    label: "Chronopost",
    track: "https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=",
  },
  {
    id: "mondial-relay",
    label: "Mondial Relay",
    track: "https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=",
  },
  { id: "ups", label: "UPS", track: "https://www.ups.com/track?loc=fr_FR&tracknum=" },
  { id: "other", label: "Autre transporteur" },
];

/**
 * Transporteur par défaut, présélectionné à l'expédition dans le back-office.
 * ⚠️ Doit rester cohérent avec `brand.shippingDetail`, qui annonce Colissimo
 * au client au moment de payer : préremplir un autre transporteur enverrait
 * un lien de suivi qui contredit la promesse faite au paiement.
 */
export const DEFAULT_CARRIER = "colissimo";

export function carrierLabel(id: string): string {
  return CARRIERS.find((c) => c.id === id)?.label ?? id;
}

/**
 * Page de suivi Postal Ninja, commune à TOUS les transporteurs.
 *
 * ⚠️ Consigne du gérant : la cliente suit son colis sur Postal Ninja, quel
 * que soit le transporteur réellement utilisé.
 *
 * ⚠️ CE LIEN N'EMPORTE PAS LE NUMÉRO. Postal Ninja n'offre aucune adresse
 * qui ouvre directement un colis (vérifié le 18/09/2026) : `/fr/p/<numéro>`
 * répond 404, `/fr/search?text=` est une recherche dans leur site, et le
 * formulaire de `/fr/track` passe par une vérification Cloudflare avant
 * d'afficher le résultat. La cliente colle donc le numéro elle-même — c'est
 * pourquoi l'e-mail et la page commande l'affichent en grand, à côté du lien.
 */
export const POSTAL_NINJA = "https://postal.ninja/fr/track";

/** Lien de suivi remis à la CLIENTE : Postal Ninja, ou "" sans numéro. */
export function lienSuiviClient(tracking: OrderTracking): string {
  return tracking.number.trim() ? POSTAL_NINJA : "";
}

/**
 * Lien de suivi chez le transporteur lui-même, ou "" s'il n'en expose pas.
 * Réservé au back-office : la cliente, elle, est envoyée sur Postal Ninja
 * (`lienSuiviClient`).
 */
export function trackingUrl(tracking: OrderTracking): string {
  const carrier = CARRIERS.find((c) => c.id === tracking.carrier);
  const number = tracking.number.trim();
  return carrier?.track && number ? carrier.track + encodeURIComponent(number) : "";
}
