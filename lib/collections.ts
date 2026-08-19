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
/**
 * Lignes de produits — pages de catégorie visant les termes réellement
 * cherchés, et maillage interne vers les fiches.
 *
 * ⚠️ `nom` doit correspondre EXACTEMENT au champ `collection` des produits
 * (`lib/products.ts`). Sinon la page se construit VIDE, sans erreur ni
 * avertissement : rien ne signale la faute de frappe.
 *
 * Les deux entrées ci-dessous sont calées sur le catalogue de démonstration.
 * À remplacer par les vraies lignes de la boutique, une par famille.
 */
export const LIGNES: Ligne[] = [
  {
    slug: "signature",
    nom: "Signature",
    h1: "La ligne Signature",
    titreSeo: "Ligne Signature — à réécrire avec le terme cherché",
    description:
      "Description affichée dans les résultats de recherche. La réécrire avec les mots que la clientèle tape réellement, sans bourrage.",
    intro: [
      "Ce paragraphe se lit avant la grille de produits : il place les termes de recherche et dit à qui la ligne s'adresse.",
      "Un second paragraphe pour répondre à l'objection la plus fréquente sur cette famille de produits.",
    ],
  },
  {
    slug: "atelier",
    nom: "Atelier",
    h1: "La ligne Atelier",
    titreSeo: "Ligne Atelier — à réécrire avec le terme cherché",
    description:
      "Seconde page de catégorie d'exemple, pour montrer le maillage entre lignes.",
    intro: [
      "Chaque ligne a sa page : c'est ce qui fait remonter les fiches vers des pages visant des termes plus larges.",
      "Sans ces pages, une boutique n'existe que par ses fiches produit, et rate les recherches génériques.",
    ],
  },
];

export const ligneParSlug = (slug: string) =>
  LIGNES.find((l) => l.slug === slug);

/** Retrouve la page de ligne d'un produit, pour le fil d'Ariane des fiches. */
export const ligneDuProduit = (collection: string) =>
  LIGNES.find((l) => l.nom === collection);
