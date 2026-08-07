/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ORIGINE D'UNE VENTE                                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Fonction PURE, utilisable des deux côtés.
 *
 * ⚠️ On retient la PREMIÈRE origine connue de la visiteuse, pas la dernière :
 * quelqu'un qui découvre la boutique par Pinterest, revient trois jours plus
 * tard en tapant le nom, puis commande, doit rester attribué à Pinterest.
 * Attribuer au dernier clic ferait remonter « direct » sur presque tout et
 * masquerait ce qui fait réellement venir les clientes.
 */

export type SourceVente =
  | "pinterest" | "snapchat" | "instagram" | "facebook" | "tiktok"
  | "google" | "bing" | "ia" | "email" | "publicite" | "direct" | "autre";

export const SOURCE_LABEL: Record<SourceVente, string> = {
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  google: "Google",
  bing: "Bing",
  ia: "Assistant IA",
  email: "E-mail",
  publicite: "Publicité",
  direct: "Direct",
  autre: "Autre",
};

/**
 * Déduit l'origine d'une visite.
 *
 * `utm_source` prime sur le référent : une campagne balisée sait mieux d'où
 * elle vient qu'une en-tête HTTP, que les applications mobiles effacent
 * souvent.
 *
 * ⚠️ Les assistants génératifs (ChatGPT, Perplexity, Copilot…) sont isolés
 * sous `ia` : c'est un canal d'acquisition à part entière — le « GEO » — et
 * le confondre avec le référencement classique empêcherait de mesurer s'il
 * rapporte quoi que ce soit.
 */
export function detecterSource(
  referrer: string | null | undefined,
  params?: URLSearchParams | null,
): SourceVente {
  const utm = params?.get("utm_source")?.trim().toLowerCase() ?? "";
  const paye = !!params?.get("gclid") || !!params?.get("fbclid") ||
    (params?.get("utm_medium") ?? "").toLowerCase().includes("cpc");
  const hay = `${utm} ${referrer ?? ""}`.toLowerCase();

  const test = (...m: string[]) => m.some((x) => hay.includes(x));

  if (test("pinterest", "pin.it")) return "pinterest";
  if (test("snapchat", "snap.com", "sc-cta")) return "snapchat";
  if (test("instagram")) return "instagram";
  if (test("facebook", "fb.com", "m.facebook")) return "facebook";
  if (test("tiktok")) return "tiktok";
  if (test("chatgpt", "openai", "perplexity", "claude.ai", "copilot", "gemini.google", "you.com"))
    return "ia";
  if (test("newsletter", "mailing", "resend", "mail.")) return "email";
  if (test("google")) return paye ? "publicite" : "google";
  if (test("bing", "duckduckgo", "ecosia", "qwant", "yahoo")) return "bing";
  if (paye) return "publicite";
  if (utm) return "autre";
  if (!referrer) return "direct";
  return "autre";
}
