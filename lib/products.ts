export interface ProductVariant {
  id: string;
  label: string;
  /** Surcoût par rapport au prix de base, en centimes. */
  priceDelta: number;
  stock: number;
}

/** Section narrative de la fiche produit, sous la partie technique. */
export interface ProductStory {
  title: string;
  body: string;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  /** Prix de base en centimes. */
  price: number;
  /**
   * Ancien prix, affiché barré à côté du prix courant. Purement indicatif :
   * il n'entre dans aucun calcul et ne part dans aucun paiement.
   *
   * ⚠️ ENCADRÉ PAR LA LOI en France : le prix de référence doit être le prix
   * le plus bas réellement pratiqué dans les 30 jours précédents
   * (art. L112-1-1, directive Omnibus). Un ancien prix inventé est une
   * pratique commerciale trompeuse.
   *
   * Ignoré s'il n'est pas strictement supérieur à `price`.
   */
  compareAtPrice?: number;
  collection: string;
  /** 1re caractéristique affichée sur la fiche (libellé : « Matières »). */
  material: string;
  /** 2e caractéristique — libellé défini par `brand.productDetailLabel`. */
  detail: string;
  description: string;

  /**
   * Récit affiché APRÈS la fiche technique et les réassurances : il ne sert
   * pas à informer mais à donner envie, une fois l'objection rationnelle
   * levée. Facultatif — la section disparaît si le champ est absent.
   * ⚠️ Éditable dans le back-office (`components/admin/ProductForm.tsx`) :
   * un champ absent du formulaire serait effacé à la première modification.
   */
  story?: ProductStory;
  /**
   * Code-barres du fabricant (EAN-13, UPC…), s'il en existe un.
   *
   * ⚠️ NE JAMAIS L'INVENTER. Un GTIN erroné rattache l'article à un tout autre
   * produit dans Merchant Center : Google constate l'écart de prix ou de titre
   * et désapprouve l'article, parfois tout le compte. Laisser vide tant que le
   * fournisseur n'en communique pas un — `mpn` + `brand` suffisent alors.
   */
  gtin?: string;
  /**
   * Étiquette de segmentation pour les campagnes Google Ads
   * (`custom_label_0` du flux). Interne : jamais affichée à l'internaute.
   * Absente = valeur par défaut définie dans `app/feed.xml/route.ts`.
   */
  etiquetteAds?: string;
  images: string[];
  variants: ProductVariant[];
  featured?: boolean;
  /** Si true : le stock est suivi et affiché au client. Sinon, stock masqué et illimité. */
  manageStock?: boolean;
  /** Si true : le produit est retiré de la boutique (listes + fiche en 404). Absent = visible. */
  hidden?: boolean;
}

/**
 * Catalogue de la boutique.
 * Images réelles optimisées (WebP) dans /public/products.
 */
export const seedProducts: Product[] = [
  {
    slug: "modele-un",
    name: "Modèle Un",
    tagline: "La pièce d'entrée",
    price: 12900,
    collection: "Signature",
    material: "Matière à renseigner",
    detail: "Caractéristique à renseigner",
    description:
      "Description de démonstration. C'est le texte qui vend le produit : ce qu'il apporte concrètement, à qui il s'adresse, ce qui le distingue. Comptez 3 à 5 phrases — assez pour convaincre, assez court pour être lu en entier.",
    images: ["/products/demo-un-1.svg", "/products/demo-un-2.svg"],
    variants: [{ id: "standard", label: "Standard", priceDelta: 0, stock: 12 }],
    featured: true,
  },
  {
    slug: "modele-deux",
    name: "Modèle Deux",
    tagline: "Avec déclinaisons",
    price: 18900,
    collection: "Signature",
    material: "Matière à renseigner",
    detail: "Caractéristique à renseigner",
    description:
      "Ce produit montre les VARIANTES : chaque déclinaison porte son propre stock et peut coûter plus cher que le prix de base (`priceDelta`, en centimes). C'est ce mécanisme qui sert aux tailles, aux finitions ou aux coloris.",
    images: ["/products/demo-deux-1.svg", "/products/demo-deux-2.svg"],
    variants: [
      { id: "s", label: "Petit", priceDelta: 0, stock: 6 },
      { id: "m", label: "Moyen", priceDelta: 2000, stock: 4 },
      { id: "l", label: "Grand", priceDelta: 4500, stock: 0 },
    ],
    featured: true,
    manageStock: true,
  },
  {
    slug: "modele-trois",
    name: "Modèle Trois",
    tagline: "Stock masqué",
    price: 24900,
    collection: "Atelier",
    material: "Matière à renseigner",
    detail: "Caractéristique à renseigner",
    description:
      "Sans `manageStock`, le stock n'est ni suivi ni affiché au client : le produit reste commandable en permanence. À utiliser pour de l'impression à la demande ou du réapprovisionnement continu.",
    images: ["/products/demo-trois-1.svg", "/products/demo-trois-2.svg"],
    variants: [{ id: "standard", label: "Standard", priceDelta: 0, stock: 0 }],
    featured: true,
  },
  {
    slug: "modele-quatre",
    name: "Modèle Quatre",
    tagline: "Haut de gamme",
    price: 42000,
    collection: "Atelier",
    material: "Matière à renseigner",
    detail: "Caractéristique à renseigner",
    description:
      "Quatrième produit de démonstration, présent pour vérifier la mise en page de la grille de collection et le comportement du panier avec plusieurs articles.",
    images: ["/products/demo-quatre-1.svg", "/products/demo-quatre-2.svg"],
    variants: [{ id: "standard", label: "Standard", priceDelta: 0, stock: 3 }],
    manageStock: true,
  },
];

/** Pur (client-safe) : formatage de prix. */
export function formatPrice(cents: number, currency = "EUR", locale = "fr-FR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100,
  );
}
