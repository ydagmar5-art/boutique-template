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
      /**
       * ⚠️ Stockage des images envoyées depuis le back-office.
       *
       * Sans cette entrée, `next/image` REFUSE toute photo uploadée : en
       * production les fichiers partent dans un bucket Supabase (le disque de
       * Vercel est en lecture seule), et un hôte absent d'ici fait échouer
       * l'optimisation — la photo ne s'affiche pas du tout. Le piège est que
       * rien ne se voit en local, où les fichiers restent dans `public/`.
       */
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/**" },
    ],
    /**
     * QUOTA VERCEL — plan gratuit : 5 000 transformations / mois.
     *
     * Sans ces deux paramètres, Vercel recalcule CHAQUE variante d'image à
     * chaque expiration (TTL par défaut : 60 s), et génère jusqu'à 8 tailles
     * par image. Avec 347 photos produit, le quota sautait en quelques jours.
     *
     * minimumCacheTTL : les variantes transformées vivent 1 an dans le cache
     * Vercel. Une image transformée une fois ne l'est plus jamais (sauf si
     * le fichier source change). Économie : ~98 % des transformations.
     *
     * deviceSizes : seules 3 largeurs sont générées au lieu des 8 par défaut.
     * Elles couvrent mobile (640), tablette/laptop (1080) et grand écran
     * (1920) — les `sizes` déjà en place sur les composants font le reste.
     *
     * formats : on force WebP uniquement. Générer aussi AVIF doublerait le
     * nombre de transformations (2× par image), sans gain visible à ce stade.
     */
    minimumCacheTTL: 31_536_000, // 1 an — la valeur par défaut est 60 s
    deviceSizes: [640, 1080, 1920], // 3 tailles au lieu de 8 par défaut
    formats: ["image/webp"], // pas d'AVIF pour ne pas doubler les transformations
    /**
     * ⚠️ OPTIMISATION DÉSACTIVÉE — décision assumée, pas un oubli.
     *
     * Quota dépassé, Vercel répond `HTTP 402` sur toute variante absente du
     * cache : la photo ne s'affiche PAS. Le dépassement ne se contente donc
     * pas d'afficher un avertissement dans le tableau de bord, il casse la
     * vitrine — et d'abord pour les visiteuses qui arrivent sur un modèle
     * peu consulté, dont les variantes n'ont jamais été calculées.
     *
     * `unoptimized` sert les fichiers d'origine tels quels, depuis le CDN :
     * zéro transformation, donc plus jamais de 402. Le coût est acceptable
     * ici parce que les sources sont DÉJÀ optimisées en amont — WebP, côté
     * long plafonné à 1600 px par `optimise()` dans les formulaires du
     * back-office. Moyenne constatée : 100 Ko par photo.
     *
     * Ce que l'on perd : le redimensionnement par largeur d'écran. Un mobile
     * télécharge la même image qu'un grand écran. À 100 Ko la photo, l'écart
     * ne justifie pas de casser la boutique en attendant le 1er du mois.
     *
     * ⚠️ Les trois réglages ci-dessus deviennent inertes tant que cette ligne
     * est là. Ils sont conservés pour qu'un simple retrait de `unoptimized`
     * rétablisse une optimisation déjà bornée, sans reproduire le dépassement.
     */
    unoptimized: true,
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
