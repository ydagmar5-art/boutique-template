/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PAGES DE LIGNE — les pages de catégorie du référencement        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Avant elles, le site n'avait qu'une seule page pour couvrir cabas, seaux,
 * portés épaule, portés main et petits formats. Or c'est sur ces termes-là
 * que se fait la recherche — « cabas en cuir femme », « sac seau cuir » — et
 * ce sont des pages de catégorie qui les captent, jamais une page « toute la
 * collection ».
 *
 * ⚠️ `nom` DOIT correspondre exactement au champ `collection` du catalogue :
 * c'est la clé de rapprochement. Renommer une ligne dans `lib/products.ts`
 * sans la renommer ici vide la page de ses produits, en silence.
 *
 * ⚠️ LE TEXTE ENGAGE LA MAISON. « Porté main » contient les trois modèles en
 * PVC (Bari, Concorde, Pigalle) : son introduction ne dit donc jamais « tous
 * en cuir ». Les quatre autres lignes sont intégralement en cuir, ce qui est
 * vérifié dans le catalogue. Relire le HANDOFF §2 avant d'y toucher.
 */

export interface Ligne {
  /** Segment d'URL : /collections/<slug>. */
  slug: string;
  /** ⚠️ Identique au champ `collection` des produits. */
  nom: string;
  /** Titre affiché sur la page. Le nom de la ligne, pas un slogan. */
  h1: string;
  /** Titre de l'onglet et du résultat Google — mène par le terme cherché. */
  titreSeo: string;
  description: string;
  /** Deux paragraphes d'introduction, affichés sous le titre. */
  intro: string[];
}

/**
 * Lignes de produits — pages de catégorie visant les termes réellement
 * cherchés, et maillage interne vers les fiches.
 *
 * ⚠️ Le champ `collection` doit correspondre EXACTEMENT à celui des produits
 * (`lib/products.ts`), sinon la page se construit vide sans erreur.
 *
 * Exemple calé sur le catalogue de démonstration : à remplacer par les vraies
 * lignes de la boutique, une par famille de produits.
 */
export const LIGNES: Ligne[] = [
  {
    slug: "demonstration",
    // ⚠️ Identique au champ `collection` des produits, sinon la page se
    // construit vide, sans erreur ni avertissement.
    nom: "Démonstration",
    h1: "La ligne de démonstration",
    titreSeo: "Ligne de démonstration — à remplacer",
    description:
      "Page de catégorie d'exemple. La réécrire avec les termes que la clientèle tape réellement, et vérifier que `collection` correspond au catalogue.",
    intro: [
      "Ce texte d'introduction se lit avant la grille de produits : y placer les mots que la clientèle tape réellement, sans bourrage.",
      "Un second paragraphe pour répondre à l'objection la plus fréquente sur cette famille de produits.",
    ],
  },
];

export const ligneParSlug = (slug: string) =>
  LIGNES.find((l) => l.slug === slug);

/** Retrouve la page de ligne d'un produit, pour le fil d'Ariane des fiches. */
export const ligneDuProduit = (collection: string) =>
  LIGNES.find((l) => l.nom === collection);
