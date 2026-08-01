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
  },
  /**
   * Le widget de paiement Fondy (checkout.js) charge ses packs de langue en
   * chemin ABSOLU-RACINE — il les cherche donc sur notre domaine (`/i18n/fr.js`)
   * et non sur le sien. Sans ce proxy, la promesse de chargement échoue et le
   * formulaire reste en anglais, surcharges de textes comprises.
   * On proxifie plutôt que de copier le fichier : il reste ainsi aligné sur la
   * version de checkout.js servie par Fondy.
   */
  async rewrites() {
    return [
      {
        source: "/i18n/:file",
        destination: "https://pay.fondy.eu/latest/i18n/:file",
      },
    ];
  },
};

export default nextConfig;
