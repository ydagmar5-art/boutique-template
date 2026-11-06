/**
 * Montant renvoyé par Whop → centimes.
 *
 * ⚠️ Whop a changé la forme de ses montants (constaté le 06/11/2026) : un
 * NOMBRE en unités monétaires (`1.0` pour 1 €) dans les anciennes versions de
 * l'API, un objet « Money » `{ amount: "1.00", currency, decimals }` dans les
 * nouvelles. On lit les deux formes ; la première valeur exploitable gagne.
 */
export function centimesWhop(...valeurs: unknown[]): number | undefined {
  for (const v of valeurs) {
    const brut = v && typeof v === "object" ? (v as { amount?: unknown }).amount : v;
    const n =
      typeof brut === "number" ? brut
      : typeof brut === "string" && brut.trim() !== "" ? Number(brut)
      : NaN;
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return undefined;
}
