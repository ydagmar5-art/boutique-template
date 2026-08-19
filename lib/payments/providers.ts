import type { PaymentProvider } from "./types";

/** Champs standards clé publique + secrète. */
const apiKeyPair = (pubLabel: string, secLabel: string, pubHint?: string) => [
  { key: "publicKey", label: pubLabel, hint: pubHint },
  { key: "secretKey", label: secLabel, secret: true },
  { key: "webhookSecret", label: "Secret de webhook", secret: true },
];

/**
 * Registre des 7 passerelles. Chaque entrée décrit comment l'intégrer DE FAÇON
 * CONFORME (élément hébergé / redirection) — jamais de stockage de carte.
 */
export const PAYMENT_PROVIDERS: Record<string, PaymentProvider> = {
  test: {
    id: "test",
    name: "Test (paiement simulé)",
    integration: "hosted-elements",
    pciScope: "SAQ-A",
    description:
      "Processeur de démonstration : affiche le formulaire carte et valide TOUJOURS le paiement, quels que soient les numéros saisis. À désactiver avant d'encaisser réellement.",
    docsUrl: "#",
    webhookSigned: false,
    functional: true,
    fields: { test: [], live: [] },
  },
  stripe: {
    id: "stripe",
    name: "Stripe",
    integration: "hosted-elements",
    pciScope: "SAQ-A",
    description:
      "Payment Element : champs carte affichés directement sur le site, sans redirection.",
    docsUrl: "https://docs.stripe.com/payments/payment-element",
    webhookSigned: true,
    functional: true,
    fields: {
      test: apiKeyPair("Clé publishable (test)", "Clé secrète (test)", "pk_test_..."),
      live: apiKeyPair("Clé publishable (live)", "Clé secrète (live)", "pk_live_..."),
    },
  },
  square: {
    id: "square",
    name: "Square",
    integration: "hosted-elements",
    pciScope: "SAQ-A",
    description: "Square Web Payments SDK. Carte tokenisée en nonce sécurisé.",
    docsUrl: "https://developer.squareup.com/docs/checkout-api",
    webhookSigned: true,
    functional: true,
    fields: {
      test: [
        { key: "applicationId", label: "Application ID (sandbox)" },
        { key: "locationId", label: "Location ID" },
        { key: "accessToken", label: "Access token (sandbox)", secret: true },
      ],
      live: [
        { key: "applicationId", label: "Application ID (production)" },
        { key: "locationId", label: "Location ID" },
        { key: "accessToken", label: "Access token (production)", secret: true },
      ],
    },
  },
  fondy: {
    id: "fondy",
    name: "Fondy",
    integration: "hosted-elements",
    // Le formulaire embarqué de Fondy rend ses champs carte dans NOTRE page
    // (pas dans une iframe comme Stripe/Square) : la carte part du navigateur
    // vers api.fondy.eu sans toucher nos serveurs, mais le périmètre PCI est
    // SAQ-A-EP et non SAQ-A. Le repli hébergé, lui, reste en SAQ-A.
    pciScope: "SAQ-A-EP",
    description:
      "Checkout embarqué : champs carte affichés sur le site, 3-D Secure en fenêtre modale, aucune redirection. Repli automatique sur la page hébergée Fondy si le widget ne se charge pas.",
    docsUrl: "https://docs.fondy.io/gateway/embedded/embedded-custom-checkout/",
    webhookSigned: true,
    functional: true,
    fields: {
      test: [
        { key: "merchantId", label: "Merchant ID (test)", hint: "1396424 = compte de démo Fondy" },
        { key: "password", label: "Mot de passe / clé secrète (test)", secret: true },
      ],
      live: [
        { key: "merchantId", label: "Merchant ID (live)" },
        { key: "password", label: "Mot de passe / clé secrète (live)", secret: true },
      ],
    },
  },
  mollie: {
    id: "mollie",
    name: "Mollie",
    integration: "hosted-elements",
    pciScope: "SAQ-A",
    description:
      "Champs carte Mollie Components, hébergés par Mollie en iframe et posés dans la page. Le 3-D Secure se fait chez Mollie, puis le client revient sur la boutique.",
    docsUrl: "https://docs.mollie.com/docs/mollie-components",
    webhookSigned: false,
    fields: {
      test: [
        { key: "profileId", label: "Profile ID (pfl_…)" },
        { key: "apiKey", label: "Clé API (test_…)", secret: true },
      ],
      live: [
        { key: "profileId", label: "Profile ID (pfl_…)" },
        { key: "apiKey", label: "Clé API (live_…)", secret: true },
      ],
    },
  },

  zen: {
    id: "zen",
    name: "Zen.com",
    integration: "hosted-checkout",
    pciScope: "SAQ-A",
    description: "Zen Checkout hébergé. Redirection vers la page sécurisée Zen.",
    docsUrl: "https://docs.zen.com/",
    webhookSigned: true,
    fields: {
      test: [
        { key: "merchantId", label: "Merchant ID" },
        { key: "apiKey", label: "Clé API (sandbox)", secret: true },
        { key: "ipnSecret", label: "Secret IPN", secret: true },
      ],
      live: [
        { key: "merchantId", label: "Merchant ID" },
        { key: "apiKey", label: "Clé API (live)", secret: true },
        { key: "ipnSecret", label: "Secret IPN", secret: true },
      ],
    },
  },
  viva: {
    id: "viva",
    name: "Viva.com",
    integration: "hosted-elements",
    /**
     * ⚠️ SAQ A-EP, et c'est le SEUL PSP de la boutique dans ce cas avec Fondy.
     * Le SDK Native Checkout v2 lit de vrais `<input>` de notre page — il
     * n'y a pas d'iframe hébergée par Viva. La carte ne touche pas nos
     * serveurs, mais elle passe par notre DOM : tout script tiers ajouté au
     * tunnel pourrait la lire.
     */
    pciScope: "SAQ-A-EP",
    description:
      "Native Checkout v2 : champs carte intégrés à la page, 3-D Secure en surcouche, aucune redirection. L'ordre est créé côté serveur et le débit est déclenché avec un jeton de carte à usage unique.",
    docsUrl: "https://developer.viva.com/apis-for-payments/",
    /**
     * ⚠️ false, contrairement à ce qui était déclaré auparavant : Viva ne signe
     * PAS ses webhooks. La clé de vérification ne sert qu'à prouver la
     * propriété de l'URL à l'enregistrement. La preuve d'encaissement vient de
     * la relecture de la transaction avec nos clés.
     */
    webhookSigned: false,
    functional: true,
    fields: {
      test: [
        { key: "merchantId", label: "Merchant ID (demo)" },
        { key: "apiKey", label: "Clé API (demo)", secret: true },
        { key: "clientId", label: "Client ID (OAuth demo)" },
        { key: "clientSecret", label: "Client secret (OAuth demo)", secret: true },
        { key: "sourceCode", label: "Code source de paiement", hint: "4 chiffres" },
      ],
      live: [
        { key: "merchantId", label: "Merchant ID (live)" },
        { key: "apiKey", label: "Clé API (live)", secret: true },
        { key: "clientId", label: "Client ID (OAuth live)" },
        { key: "clientSecret", label: "Client secret (OAuth live)", secret: true },
        { key: "sourceCode", label: "Code source de paiement", hint: "4 chiffres" },
      ],
    },
  },
  mypos: {
    id: "mypos",
    name: "myPOS",
    integration: "hosted-checkout",
    pciScope: "SAQ-A",
    description: "myPOS Checkout hébergé, signature RSA des requêtes.",
    docsUrl: "https://developers.mypos.com/",
    webhookSigned: true,
    fields: {
      test: [
        { key: "sid", label: "Store ID (SID)" },
        { key: "walletNumber", label: "Numéro de wallet" },
        { key: "privateKey", label: "Clé privée RSA (test)", secret: true },
      ],
      live: [
        { key: "sid", label: "Store ID (SID)" },
        { key: "walletNumber", label: "Numéro de wallet" },
        { key: "privateKey", label: "Clé privée RSA (live)", secret: true },
      ],
    },
  },
  whop: {
    id: "whop",
    name: "Whop",
    integration: "hosted-elements",
    functional: true,
    pciScope: "SAQ-A",
    description:
      "Checkout embarqué : le formulaire de carte est monté par Whop dans une iframe, le client ne quitte pas la boutique. Le montant est créé à la volée au prix exact du panier — remises, articles multiples et produits ajoutés dans l'admin sont pris en charge sans créer de plan chez Whop.",
    docsUrl: "https://docs.whop.com/",
    webhookSigned: true,
    fields: {
      test: [
        { key: "apiKey", label: "Clé API (test)", secret: true },
        { key: "webhookSecret", label: "Secret de webhook", secret: true },
        { key: "productId", label: "Produit Whop (prod_…)", hint: "Produit auquel rattacher les plans créés à la volée" },
      ],
      live: [
        { key: "apiKey", label: "Clé API (live)", secret: true },
        { key: "webhookSecret", label: "Secret de webhook", secret: true },
        { key: "productId", label: "Produit Whop (prod_…)", hint: "Produit auquel rattacher les plans créés à la volée" },
      ],
    },
  },
  genome: {
    id: "genome",
    name: "Genome",
    integration: "hosted-checkout",
    pciScope: "SAQ-A",
    description:
      "Page de paiement hébergée (HPP) : redirection vers pay.genome.eu avec un jeton JWT signé, puis confirmation par callback serveur signé. ⚠️ L'URL du callback ne se transmet pas dans la requête — elle se déclare dans le tableau de bord Genome : /api/webhooks/genome. Les tests se font avec la devise XTS sur un compte de test.",
    docsUrl: "https://developers.genome.eu/merchant/hosted-payment-page/",
    webhookSigned: true,
    functional: true,
    fields: {
      test: [
        { key: "apiKey", label: "Clé API (test)", hint: "identifiant `iss` du jeton" },
        { key: "apiSecret", label: "Secret API (test)", secret: true },
      ],
      live: [
        { key: "apiKey", label: "Clé API (live)", hint: "identifiant `iss` du jeton" },
        { key: "apiSecret", label: "Secret API (live)", secret: true },
      ],
    },
  },
  airwallex: {
    id: "airwallex",
    name: "Airwallex",
    integration: "hosted-elements",
    pciScope: "SAQ-A",
    description:
      "Card Element embarqué : champs carte affichés sur le site, 3-D Secure en surcouche, aucune redirection. Le PaymentIntent est créé côté serveur et le paiement est revérifié auprès d'Airwallex avant d'enregistrer la commande.",
    docsUrl: "https://www.airwallex.com/docs/payments__embedded-elements__card-element",
    webhookSigned: true,
    functional: true,
    fields: {
      test: [
        { key: "clientId", label: "Client ID" },
        { key: "apiKey", label: "Clé API (demo)", secret: true },
        { key: "webhookSecret", label: "Secret de webhook", secret: true },
      ],
      live: [
        { key: "clientId", label: "Client ID" },
        { key: "apiKey", label: "Clé API (live)", secret: true },
        { key: "webhookSecret", label: "Secret de webhook", secret: true },
      ],
    },
  },
};

export const getProvider = (id: string) => PAYMENT_PROVIDERS[id];
