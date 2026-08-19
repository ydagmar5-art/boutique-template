/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  WHOP — produit parapluie des plans dynamiques                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * En prix dynamique, la boutique ne tient PAS un plan Whop par produit : à
 * chaque paiement elle crée une configuration de checkout au montant exact du
 * panier — remises, offres et articles multiples compris.
 *
 * Whop exige seulement que le plan éphémère soit rattaché à un produit. Ce
 * produit ne sert qu'à ça : ni prix, ni page à tenir à jour.
 *
 * ⚠️ Laissé VIDE ici : l'identifiant se saisit dans /admin/payments (champ
 * « Produit Whop »), parce qu'il dépend du compte Whop de CETTE boutique.
 * Ce n'est pas un secret — il transite de toute façon dans la page.
 */
export const WHOP_PRODUCT_ID = "";

/** Version d'API épinglée : Whop fait évoluer la forme des réponses. */
export const WHOP_API_VERSION = "2026-08-10";
