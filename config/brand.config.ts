/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  IDENTITÉ DE LA MARQUE                                           ║
 * ║                                                                  ║
 * ║  Nom, palette, mentions légales, PSP proposés.                   ║
 * ║  Les couleurs deviennent des variables CSS `--c-*` (voir         ║
 * ║  `brandCssVars`) consommées par Tailwind.                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Les trois autres fichiers à renseigner pour une nouvelle boutique :
 *   · `config/store.config.ts` — préfixe technique (tables, cookies)
 *   · `config/fonts.ts`        — typographie (imports statiques)
 *   · `lib/db/seed.ts`         — catalogue de départ
 *
 * ⚠️ Changer ce fichier NE SUFFIT PAS à rhabiller la boutique : la vitrine
 * (`app/(storefront)/`) contient le discours commercial, il se réécrit.
 * Voir la frontière noyau/peau dans TEMPLATE-HANDOFF.md.
 */

export type PaymentProviderId =
  | "test"
  | "stripe"
  | "square"
  | "fondy"
  | "zen"
  | "viva"
  | "mypos"
  | "whop"
  | "airwallex";

export interface BrandConfig {
  name: string;
  legalName: string;
  tagline: string;
  description: string;
  locale: string;
  currency: string;
  currencySymbol: string;
  /**
   * Libellé de la 2e caractéristique produit, sur la fiche et dans l'admin.
   * Lampes : « Lumière ». Montres : « Mouvement ». Chaussures : « Semelle ».
   */
  productDetailLabel: string;
  /**
   * Les 4 réassurances affichées sur l'accueil, les fiches produit et le
   * checkout. ⚠️ Ce sont des ENGAGEMENTS COMMERCIAUX : ils doivent
   * correspondre à la réalité et aux CGV de la boutique.
   * Icônes disponibles : truck · lock · return · shield.
   */
  reassurances: { icon: "truck" | "lock" | "return" | "shield"; title: string; sub: string }[];
  /** Mention de livraison, reprise en pied de page et au checkout. */
  shippingNote: string;
  colors: Record<string, string>;
  nav: { label: string; href: string }[];
  contact: { email: string; phone: string; city: string };
  social: { label: string; href: string }[];
  /** PSP proposés dans le hub de paiement du back-office. */
  payments: PaymentProviderId[];
  /** Informations légales de l'exploitant (pages obligatoires). */
  legal: {
    operator: string;
    legalForm: string;
    siren: string;
    siret: string;
    ape: string;
    vat: string;
    address: string;
    director: string;
    email: string;
    phone: string;
    host: { name: string; address: string; url: string };
  };
}

export const brand: BrandConfig = {
  name: "STUDIO",
  legalName: "À renseigner",
  tagline: "Le modèle de boutique, prêt à rhabiller",
  description:
    "Boutique de démonstration. Remplacez ce texte par la promesse de la marque : il alimente la balise description et le partage sur les réseaux.",
  locale: "fr-FR",
  currency: "EUR",
  currencySymbol: "€",
  productDetailLabel: "Caractéristique",

  reassurances: [
    { icon: "truck", title: "Livraison offerte", sub: "À confirmer" },
    { icon: "lock", title: "Paiement sécurisé", sub: "Cryptage bancaire" },
    { icon: "return", title: "Retour 30 jours", sub: "Satisfait ou remboursé" },
    { icon: "shield", title: "Garantie", sub: "Durée à renseigner" },
  ],
  shippingNote: "Livraison offerte",


  /**
   * Palette neutre de départ. Les 11 clés doivent TOUTES rester présentes —
   * elles deviennent les variables CSS `--c-*` utilisées dans tout le code.
   * En supprimer une casse le rendu sans erreur de compilation.
   *
   * ⚠️ Piège Tailwind : `bg-ink/40` sort TRANSPARENT (une variable CSS ne
   * peut pas recevoir d'alpha). Utiliser `bg-black/40`.
   */
  colors: {
    bg: "#FBFAF8", // fond de page
    surface: "#FFFFFF", // cartes, panneaux
    ink: "#1C1B19", // texte principal
    muted: "#6E6A63", // texte secondaire
    primary: "#8A7C6A", // accent principal (boutons, liens)
    "primary-dark": "#6B5F51", // survol de l'accent
    secondary: "#A6584A", // alertes, erreurs, prix barrés
    organic: "#7C8A72", // succès, réassurance
    halo: "#EFE9E0", // fonds doux, halos
    border: "#E6E1D9", // filets et bordures
    "glow-shadow": "rgba(138,124,106,0.35)", // ombre colorée
  },

  // La typographie se change dans `config/fonts.ts` (imports statiques).

  nav: [
    { label: "Collection", href: "/products" },
    { label: "Notre histoire", href: "/#histoire" },
    { label: "Savoir-faire", href: "/#savoir-faire" },
  ],

  contact: {
    email: "contact@exemple.fr",
    phone: "",
    city: "",
  },

  social: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "Pinterest", href: "https://pinterest.com" },
  ],

  // Passerelles proposées dans le back-office (test + 8 PSP réels).
  payments: ["test", "stripe", "square", "fondy", "zen", "viva", "mypos", "whop", "airwallex"],

  /**
   * ⚠️ OBLIGATOIRE AVANT MISE EN LIGNE. Ces champs alimentent les mentions
   * légales, les CGV, la politique de confidentialité et la page de
   * remboursement. Publier une boutique avec les identifiants d'une AUTRE
   * entreprise n'est pas un détail cosmétique : c'est de la fausse
   * information légale, et les PSP refusent l'ouverture de compte quand les
   * mentions ne correspondent pas au titulaire.
   */
  legal: {
    operator: "À RENSEIGNER",
    legalForm: "À RENSEIGNER (ex. Entrepreneur individuel)",
    siren: "À RENSEIGNER",
    siret: "À RENSEIGNER",
    ape: "À RENSEIGNER",
    vat: "À RENSEIGNER (ex. TVA non applicable, article 293 B du CGI)",
    address: "À RENSEIGNER",
    director: "À RENSEIGNER",
    email: "contact@exemple.fr",
    phone: "",
    host: {
      name: "Vercel Inc.",
      address: "340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis",
      url: "https://vercel.com",
    },
  },
};

/** Génère les variables CSS injectées dans <head> depuis la palette. */
export function brandCssVars(): string {
  const vars = Object.entries(brand.colors)
    .map(([key, value]) => `--c-${key}:${value};`)
    .join("");
  return `:root{${vars}}`;
}
