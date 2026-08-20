import type { MetadataRoute } from "next";

/**
 * ⚠️ Écrit en même temps que l'ouverture du référencement.
 *
 * Sans ces exclusions, un moteur peut indexer `/admin/login`, une page de
 * paiement ou une page de confirmation de commande — cette dernière porte le
 * prénom, l'e-mail et le détail d'achat d'une cliente. Une URL de commande
 * indexée est une fuite de données personnelles, et elle survit dans le cache
 * bien après avoir été retirée.
 */
/**
 * Robots d'IA — autorisés EXPLICITEMENT, et c'est un choix.
 *
 * ChatGPT, Perplexity, Claude et Gemini répondent de plus en plus aux
 * questions d'avant-achat (« quel sac pour le travail », « cuir grainé ou
 * lisse »). Pour être cité dans ces réponses — et récupérer le clic — il faut
 * que ces robots puissent lire le site. Un `Disallow` ici, même involontaire,
 * rend la maison invisible sur ce canal.
 *
 * ⚠️ Contrepartie assumée : ces robots servent aussi à entraîner des modèles.
 * Le contenu publié est déjà public ; le refuser reviendrait à sortir du jeu
 * pour une protection que l'indexation classique n'offre pas davantage.
 * Retirer un agent de cette liste le bloque — c'est réversible à tout moment.
 *
 * Les exclusions de `/admin`, `/checkout` et `/order/` valent pour EUX AUSSI :
 * elles sont reprises dans chaque règle ci-dessous.
 */
const ROBOTS_IA = [
  "GPTBot", // OpenAI — exploration pour ChatGPT
  "OAI-SearchBot", // OpenAI — recherche en direct
  "ChatGPT-User", // OpenAI — visite déclenchée par une question
  "ClaudeBot", // Anthropic
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended", // Gemini / AI Overviews
  "Applebot-Extended",
  "Bingbot", // Copilot s'appuie sur l'index Bing
];

/**
 * ⚠️ MÊME INTERRUPTEUR QUE LA BALISE `noindex` — `NOINDEX=1`.
 *
 * `app/layout.tsx` pilotait déjà la balise meta avec cette variable, mais
 * `robots.txt` l'ignorait : une boutique en préproduction demandait donc aux
 * moteurs de ne pas l'indexer… tout en les invitant à l'explorer, sitemap
 * compris. Les deux signaux doivent venir de la même source, sans quoi ils se
 * contredisent — et c'est le plus permissif qui l'emporte en pratique.
 *
 * ⚠️ `robots.txt` demande de ne pas EXPLORER ; il n'empêche pas d'INDEXER une
 * URL découverte par un lien entrant. Seule la balise `noindex` le fait. Les
 * deux restent donc nécessaires.
 */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const interdits = ["/admin", "/admin/", "/checkout", "/order/"];

  if (process.env.NOINDEX === "1") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: interdits,
      },
      ...ROBOTS_IA.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: interdits,
      })),
    ],
    ...(site ? { sitemap: `${site}/sitemap.xml`, host: site } : {}),
  };
}
