"use client";

import type { MesureClient } from "@/lib/analytics/ga-serveur";

/**
 * Relève l'identifiant Google Analytics de la visiteuse dans ses cookies.
 *
 * ⚠️ C'EST CE QUI RATTACHE LA VENTE AU CLIC PUBLICITAIRE. Quand le serveur
 * envoie l'achat à Google (cf. `lib/analytics/ga-serveur.ts`), il doit dire
 * DE QUI il s'agit. Sans ces deux valeurs, la vente existe dans Analytics
 * mais flotte hors de toute visite : Google Ads ne peut pas la relier à
 * l'annonce qui l'a produite, et l'algorithme n'apprend rien.
 *
 * - `_ga` vaut « GA1.1.123456789.1699999999 » : l'identifiant client est
 *   formé des DEUX DERNIERS segments.
 * - `_ga_<flux>` vaut « GS2.1.s1699999999$o3$g1$t... » : le numéro de
 *   session suit le « s ».
 *
 * Renvoie un objet vide si les cookies manquent — refus de cookies, mesure
 * bloquée par le navigateur, première milliseconde de la visite.
 */
export function mesureClient(): MesureClient {
  if (typeof document === "undefined") return {};
  try {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const ga = cookies.find((c) => c.startsWith("_ga="))?.slice(4);
    const flux = cookies.find((c) => /^_ga_[A-Z0-9]+=/.test(c));

    const parts = ga?.split(".") ?? [];
    const clientId = parts.length >= 4 ? `${parts[2]}.${parts[3]}` : undefined;

    let sessionId: string | undefined;
    const valeur = flux?.split("=")[1];
    const s = valeur?.split(".")[2]; // « s1699999999$o3$g1$t… »
    const m = s?.match(/^s(\d+)/);
    if (m) sessionId = m[1];

    return { clientId, sessionId };
  } catch {
    return {};
  }
}
