/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Upload des photos produit : la limite par défaut (1 Mo) refuserait une photo de téléphone. */
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    /**
     * ⚠️ OPTIMISATION DÉSACTIVÉE — décision assumée, pas un oubli.
     *
     * Chez Hostinger, l'optimiseur d'images de Next.js tourne DANS le
     * processus de l'application, sur le CPU mutualisé du plan, et dépose ses
     * variantes dans `.next/cache`. Or un déploiement remplace tout le
     * contenu du site : le cache repart vide à chaque mise en ligne, et
     * l'intégralité du catalogue est recalculée sous le trafic. Sur une
     * boutique de trois cents photos, c'est la vitrine qui rame pendant une
     * heure après chaque correction.
     *
     * `unoptimized` sert les fichiers d'origine tels quels. C'est acceptable
     * ici parce que les sources sont DÉJÀ optimisées en amont — WebP, côté
     * long plafonné à 1600 px par `optimise()` dans les formulaires du
     * back-office. Moyenne constatée : 100 Ko par photo.
     *
     * Ce que l'on perd : le redimensionnement par largeur d'écran. Un mobile
     * télécharge la même image qu'un grand écran. À 100 Ko la photo, l'écart
     * ne justifie pas de charger le serveur mutualisé.
     *
     * ⚠️ Les deux réglages ci-dessous deviennent inertes tant que cette ligne
     * est là. Ils sont conservés pour qu'un simple retrait d'`unoptimized`
     * rétablisse une optimisation déjà bornée, et non les huit largeurs et
     * deux formats que Next.js génère par défaut.
     */
    unoptimized: true,
    deviceSizes: [640, 1080, 1920], // 3 tailles au lieu de 8 par défaut
    formats: ["image/webp"], // pas d'AVIF : deux fois plus de calcul
  },
  /**
   * Le widget de paiement Fondy (checkout.js) charge ses packs de langue en
   * chemin ABSOLU-RACINE — il les cherche donc sur notre domaine (`/i18n/fr.js`)
   * et non sur le sien. Sans ce proxy, la promesse de chargement échoue et le
   * formulaire reste en anglais, surcharges de textes comprises.
   * On proxifie plutôt que de copier le fichier : il reste ainsi aligné sur la
   * version de checkout.js servie par Fondy.
   */
  /**
   * Les guides ont été publiés sous /guides avant d'être regroupés dans le
   * blog. Redirection PERMANENTE : une URL déjà explorée ne doit jamais
   * renvoyer une 404, sous peine de perdre ce qu'elle avait acquis.
   */
  async redirects() {
    return [
      { source: "/guides", destination: "/blog", permanent: true },
      { source: "/guides/:slug", destination: "/blog/:slug", permanent: true },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/i18n/:file",
        destination: "https://pay.fondy.eu/latest/i18n/:file",
      },
      /**
       * Apple Pay vérifie la propriété du domaine en lisant ce chemin exact.
       * Le routeur ignorant les dossiers commençant par un point, la route
       * vit ailleurs et n'est exposée ici que par cette réécriture — voir
       * `app/api/apple-pay/domain-association/route.ts`.
       */
      {
        source: "/.well-known/apple-developer-merchantid-domain-association",
        destination: "/api/apple-pay/domain-association",
      },
    ];
  },
};

export default nextConfig;
