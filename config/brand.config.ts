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
 *   · `lib/products.ts`        — catalogue de départ
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
  | "airwallex"
  | "genome"
  | "mollie";

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
   * Lampes : « Lumière ». Montres : « Mouvement ». Sacs : « Format ».
   */
  productDetailLabel: string;
  /**
   * Libellé du sélecteur de variante, sur la fiche produit.
   * Lampes : « Finition ». Vêtements : « Taille ». Sacs : « Coloris ».
   */
  variantLabel: string;
  /**
   * Les 4 réassurances affichées sur l'accueil, les fiches produit et le
   * checkout. ⚠️ Ce sont des ENGAGEMENTS COMMERCIAUX : ils doivent
   * correspondre à la réalité et aux CGV de la boutique.
   * Icônes disponibles : truck · lock · return · shield.
   */
  reassurances: { icon: "truck" | "lock" | "return" | "shield"; title: string; sub: string }[];
  /** Mention de livraison, reprise en pied de page et au checkout. */
  shippingNote: string;
  /**
   * Phrase de livraison affichée sous le total, au paiement.
   * ⚠️ ENGAGEMENT OPPOSABLE : n'y nommer un transporteur et n'y annoncer un
   * délai que s'ils sont réellement tenus. Le modèle promettait « DHL ·
   * expédié sous 24–48 h » en dur, ce qu'aucune boutique ne peut garantir
   * par défaut.
   */
  shippingDetail: string;
  /**
   * Mise en avant de l'offre en cours, sur la vitrine.
   *
   * ⚠️ CE N'EST QUE DU TEXTE. La remise est calculée par le moteur d'offres
   * (`lib/actions/promotions.ts`, offre `duo`) : changer ces phrases sans
   * changer l'offre ferait mentir la boutique, et inversement. Les deux se
   * modifient ensemble.
   */
  offer: {
    /** Formulation courte, pour les rappels en ligne (fiche, panier). */
    short: string;
    eyebrow: string;
    title: string;
    sub: string;
    /*
      ⚠️ Pas de date limite ici : elle vit en base et se règle depuis le
      tableau de bord (`lib/actions/storefront.ts`, `offerDeadline`). Une
      échéance figée dans le code obligerait à redéployer pour la repousser,
      ce qui pousse à la calculer dynamiquement — et une échéance qui se
      repousse toute seule est une pratique commerciale trompeuse réputée
      telle en toute circonstance (art. L121-4, 7°).
    */
  };
  colors: Record<string, string>;
  nav: { label: string; href: string }[];
  contact: { email: string; phone: string; city: string };
  social: { label: string; href: string }[];
  /** PSP proposés dans le hub de paiement du back-office. */
  payments: PaymentProviderId[];
  /**
   * Informations légales de l'exploitant (pages obligatoires).
   *
   * ⚠️ Champs volontairement NEUTRES quant au pays d'immatriculation : le
   * modèle d'origine imposait SIREN / SIRET / code APE, qui n'existent qu'en
   * France. Une société britannique n'a ni l'un ni l'autre — afficher un
   * « SIREN : — » sur des mentions légales est pire que de ne rien afficher.
   */
  legal: {
    operator: string;
    legalForm: string;
    /** Registre du commerce : « Companies House », « RCS de Paris »… */
    registry: string;
    /** Numéro d'immatriculation tel qu'inscrit au registre. */
    registrationNumber: string;
    /** Date d'immatriculation, en toutes lettres. */
    incorporatedOn: string;
    /**
     * Numéro de TVA. ⚠️ LAISSER VIDE tant qu'il n'est pas attribué : la ligne
     * disparaît alors des mentions légales. Un numéro inventé ou un « non
     * assujetti » non vérifié est une fausse mention légale, et c'est
     * exactement ce que contrôlent les prestataires de paiement.
     */
    vatNumber: string;
    /**
     * Phrase affichée quand `vatNumber` est vide, pour expliquer l'absence
     * de numéro plutôt que de laisser un silence. Vide = rien n'est affiché.
     */
    vatNotice: string;
    /**
     * Médiateur de la consommation.
     * ⚠️ OBLIGATOIRE pour vendre à des consommateurs résidant en France
     * (art. L612-1 du Code de la consommation) : le professionnel doit
     * adhérer à un médiateur agréé ET en communiquer les coordonnées. Ne
     * jamais en nommer un sans adhésion effective — c'est vérifiable.
     */
    mediator: { name: string; address: string; url: string };
    address: string;
    director: string;
    email: string;
    phone: string;
    host: { name: string; address: string; url: string };
  };
}

export const brand: BrandConfig = {
  name: "BOUTIQUE",
  legalName: "À RENSEIGNER — raison sociale de l'exploitant",
  tagline: "L'accroche de la marque",
  // ⚠️ Ne jamais évoquer ici l'approvisionnement ou les fournisseurs :
  // consigne du gérant, et cela n'a rien à faire dans un discours de marque.
  description:
    "Une phrase qui dit ce que vend la boutique et pour qui. Reprise en meta description et sur les réseaux — à réécrire avant la mise en ligne.",
  locale: "fr-FR",
  currency: "EUR",
  currencySymbol: "€",
  // 1re caractéristique = « Matières », 2e = celle-ci.
  productDetailLabel: "Caractéristique",
  variantLabel: "Variante",

  /**
   * ⚠️ Alignées sur les CGV et la page rétractation, qui prévoient 14 jours
   * (délai légal) et des frais de renvoi à la charge du client. Ne pas
   * annoncer « 30 jours » ni « retour gratuit » sans modifier ces pages.
   * Aucun frais de port n'est calculé au panier : la livraison est donc
   * réellement offerte sur toutes les commandes.
   */
  // ⚠️ Libellés volontairement COURTS : sur mobile ils s'affichent en deux
  // colonnes, et une phrase longue y part en trois lignes.
  reassurances: [
    { icon: "truck", title: "Livraison offerte", sub: "Expédiée sous 48 h" },
    { icon: "lock", title: "Paiement sécurisé", sub: "3-D Secure" },
    { icon: "return", title: "Retour sous 14 jours", sub: "Droit de rétractation" },
    { icon: "shield", title: "Garantie légale", sub: "Conformité, vices cachés" },
  ],
  shippingNote: "Livraison offerte",
  // ⚠️ ENGAGEMENT OPPOSABLE : n'y nommer un transporteur et n'y annoncer un
  // délai que s'ils sont réellement tenus. Le délai est celui de la MISE EN
  // MAIN du transporteur, pas celui de la réception — ne jamais le reformuler
  // en « livrée sous 48 h », qui promet ce que le transporteur seul décide.
  shippingDetail: "Livraison offerte · expédiée sous 48 h",

  // ⚠️ À tenir synchronisé avec l'offre `duo` de lib/actions/promotions.ts.
  offer: {
    short: "Un article acheté, le second à −40 %",
    eyebrow: "Le privilège du duo",
    title: "Un article choisi, le second à −40 %.",
    sub: "La remise s'applique d'elle-même au panier, sans code à saisir.",
    // La date limite se règle dans le tableau de bord, pas ici.
  },

  /**
   * Palette neutre de départ — à remplacer par la direction artistique
   * validée avec le client.
   *
   * Les 11 clés doivent TOUTES rester présentes — elles deviennent les
   * variables CSS `--c-*` utilisées dans tout le code. En supprimer une
   * casse le rendu sans erreur de compilation.
   *
   * ⚠️ Piège Tailwind : `bg-ink/40` sort TRANSPARENT (une variable CSS ne
   * peut pas recevoir d'alpha). Utiliser `bg-black/40`.
   */
  colors: {
    bg: "#FFFFFF", // fond de page — blanc franc
    surface: "#FAF9F7", // cartes, panneaux, sections alternées
    ink: "#101010", // texte principal, boutons, pied de page
    muted: "#767676", // texte secondaire
    primary: "#101010", // accent = le noir lui-même (boutons, filets)
    "primary-dark": "#000000", // survol de l'accent
    secondary: "#9A5A46", // alertes, erreurs, prix barrés
    organic: "#5F7355", // succès, disponibilité
    halo: "#EDEBE8", // fonds doux, halos
    border: "#E5E3DF", // filets et bordures
    "glow-shadow": "rgba(16,16,16,0.18)", // ombre
  },

  // La typographie se change dans `config/fonts.ts` (imports statiques).

  nav: [
    { label: "Sacs", href: "/products" },
    { label: "La Maison", href: "/#maison" },
    { label: "Savoir-faire", href: "/#savoir-faire" },
    { label: "Blog", href: "/blog" },
  ],

  contact: {
    // Domaine vérifié dans Resend, et servant aussi de `reply-to` sur tous
    // les e-mails transactionnels.
    // ⚠️ Une boîte (ou un alias) DOIT exister derrière cette adresse : les
    // réponses des clientes y arrivent, et une adresse qui rebondit fait
    // chuter la réputation d'envoi du domaine entier.
    email: "contact@exemple.com",
    phone: "",
    // Ville affichée en pied de page. ⚠️ Doit correspondre au siège réel de
    // l'exploitant : afficher « Paris » parce que la marque s'appelle Paris
    // serait une fausse indication d'établissement.
    city: "À RENSEIGNER — ville du siège réel",
  },

  // Laisser vide tant que les comptes n'existent pas : un lien vers la page
  // d'accueil d'un réseau ne sert à rien.
  social: [],

  // Passerelles proposées dans le back-office (test + 9 PSP).
  // ⚠️ L'ORDRE COMPTE : `firstEnabledGateway` prend la PREMIÈRE passerelle
  // activée de cette liste. Activer une passerelle mieux placée bascule les
  // ventes immédiatement, sans avertissement.
  payments: ["test", "stripe", "mollie", "square", "fondy", "airwallex", "genome", "viva", "mypos", "whop"],

  /**
   * Exploitant réel de la boutique, d'après le certificat d'immatriculation
   * et le mémorandum d'association délivrés par Companies House.
   *
   * ⚠️ Ces mentions doivent correspondre EXACTEMENT au titulaire du compte
   * de paiement. C'est le premier point que vérifient Airwallex, Stripe et
   * consorts : un écart entre le nom du site et celui du compte fait refuser
   * l'ouverture, sans explication détaillée.
   */
  legal: {
    operator: "À RENSEIGNER — raison sociale exacte",
    legalForm: "À RENSEIGNER — forme juridique",
    registry: "À RENSEIGNER — registre (RCS de …, Companies House…)",
    registrationNumber: "À RENSEIGNER",
    incorporatedOn: "",
    // ⚠️ Vide tant que la société n'est pas immatriculée à la TVA : le seuil
    // britannique de 90 000 £ de chiffre d'affaires n'est pas atteint.
    // À renseigner le jour où il l'est — c'est une obligation, pas une option.
    vatNumber: "",
    vatNotice:
      "À RENSEIGNER — mention affichée tant qu'aucun numéro de TVA n'existe.",
    // Adhésion vérifiée par le gérant. Coordonnées relevées sur cm2c.net.
    mediator: {
      name: "À RENSEIGNER — médiateur de la consommation",
      address: "",
      url: "",
    },
    address: "À RENSEIGNER — adresse du siège",
    director: "À RENSEIGNER — dirigeant",
    email: "contact@exemple.com",
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
