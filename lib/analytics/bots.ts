/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  DÉTECTION DES ROBOTS                                            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Fonction PURE : aucun accès base ni réseau, testable et utilisable des
 * deux côtés.
 *
 * ⚠️ Pourquoi c'était nécessaire : le traceur est un composant client, on
 * croit donc souvent qu'il ne compte « que de vrais navigateurs ». C'est
 * faux — Googlebot, les robots d'audit SEO et tous les scrapeurs bâtis sur
 * Puppeteer exécutent le JavaScript. Pire, ils ne conservent PAS le
 * `localStorage` : chaque passage fabrique un nouvel identifiant, donc un
 * nouveau « visiteur unique ». Sur cette boutique, 107 des 117 visiteurs
 * enregistrés n'avaient vu qu'une seule page, et les villes les plus
 * représentées étaient Ashburn, Boardman et Singapour — des régions de
 * centres de données, pas des clientes.
 *
 * ⚠️ Ce filtre attrape les robots qui S'ANNONCENT. Un scrapeur qui usurpe
 * un agent Chrome passera au travers : c'est la limite du procédé, et c'est
 * pour cela que le traçage attend aussi que l'onglet reste visible un moment
 * (cf. `components/site/Tracker.tsx`).
 */

/**
 * Motifs d'agent utilisateur. Volontairement larges : un faux positif coûte
 * une visite non comptée, un faux négatif fausse durablement les statistiques
 * et le taux de conversion.
 */
const MOTIFS = [
  // Familles génériques
  "bot", "crawler", "spider", "crawl", "slurp", "scraper", "fetcher",
  // Navigateurs pilotés
  "headless", "phantomjs", "puppeteer", "playwright", "selenium", "webdriver",
  // Clients en ligne de commande et bibliothèques
  "curl", "wget", "python-requests", "python-urllib", "go-http-client",
  "java/", "okhttp", "axios", "node-fetch", "libwww", "httpclient", "guzzle",
  // Surveillance et prévisualisation de liens
  "monitor", "uptime", "pingdom", "statuscake", "datadog", "newrelic",
  "preview", "lighthouse", "pagespeed", "gtmetrix", "chrome-lighthouse",
  // Robots d'audit SEO et d'archivage les plus bruyants
  "ahrefs", "semrush", "mj12", "dotbot", "petalbot", "bytespider",
  "dataforseo", "serpstat", "screaming frog", "sitecheck", "archive.org_bot",
  // Aperçus des réseaux sociaux et messageries
  "facebookexternalhit", "twitterbot", "linkedinbot", "whatsapp",
  "telegrambot", "discordbot", "slackbot", "embedly", "skypeuripreview",
  // Assistants et moteurs génératifs
  "gptbot", "oai-searchbot", "chatgpt-user", "claudebot", "claude-web",
  "perplexitybot", "google-extended", "ccbot", "applebot",
];

/** true si l'agent utilisateur désigne un robot. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // Un vrai navigateur envoie toujours un UA.
  const ua = userAgent.toLowerCase();
  return MOTIFS.some((m) => ua.includes(m));
}
