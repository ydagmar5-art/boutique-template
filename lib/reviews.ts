/**
 * Avis clients affichés sur la vitrine.
 *
 * ⚠️ VIDE PAR DÉFAUT, ET CE N'EST PAS UN OUBLI.
 *
 * Afficher une note ou un témoignage inventé est une pratique commerciale
 * trompeuse (art. L121-2 du Code de la consommation), sanctionnée jusqu'à
 * deux ans d'emprisonnement et 300 000 € d'amende. Le référencement s'en
 * mêle aussi : Google déclasse les balisages d'avis non vérifiables.
 *
 * Ne remplir qu'avec des avis RÉELLEMENT reçus, et laisser la moyenne se
 * calculer — ne jamais l'écrire à la main.
 *
 * Tant que ce tableau est vide, les composants qui l'utilisent masquent
 * d'eux-mêmes la section : il n'y a rien à désactiver.
 */
export interface Review {
  /** Note sur 5, telle que laissée par la cliente. */
  rating: number;
  title: string;
  body: string;
  author: string;
  /** Produit concerné, quand la cliente le cite. Sert à afficher l'avis sur
   *  la fiche correspondante. */
  slug?: string;
}

export const reviews: Review[] = [];

/** Moyenne réelle, arrondie au dixième. `0` si aucun avis. */
export function averageRating(): number {
  if (reviews.length === 0) return 0;
  const somme = reviews.reduce((t, r) => t + r.rating, 0);
  return Math.round((somme / reviews.length) * 10) / 10;
}
