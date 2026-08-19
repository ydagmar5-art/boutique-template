import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { listOrders } from "@/lib/actions/orders";
import { SOURCE_LABEL, type SourceVente } from "@/lib/attribution";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ORIGINE DES VENTES                                              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Classe le chiffre d'affaires par canal d'acquisition. La question à
 * laquelle ce tableau répond n'est pas « d'où viennent mes visiteurs » mais
 * « quel canal me rapporte de l'argent » : deux réponses très différentes,
 * et seule la seconde décide où mettre le budget et le temps.
 *
 * ⚠️ Attribution au PREMIER contact (cf. `lib/attribution.ts`) : une visiteuse
 * venue de Pinterest qui revient trois jours plus tard en tapant le nom du
 * site reste comptée en Pinterest. C'est Pinterest qui l'a fait venir ; le
 * dernier clic aurait tout crédité à « Direct » et donné l'impression que la
 * publication ne sert à rien.
 *
 * Les commandes annulées et remboursées sont exclues : encaisser puis
 * rembourser n'est pas une vente, et les inclure ferait passer pour rentable
 * un canal qui n'apporte que des impayés.
 */
export default async function SalesSources() {
  const orders = (await listOrders()).filter(
    (o) => o.status !== "cancelled" && o.status !== "refunded",
  );

  const parSource = new Map<string, { n: number; ca: number }>();
  for (const o of orders) {
    const cle = o.source ?? "direct";
    const acc = parSource.get(cle) ?? { n: 0, ca: 0 };
    acc.n += 1;
    acc.ca += o.total;
    parSource.set(cle, acc);
  }

  const lignes = [...parSource.entries()].sort((a, b) => b[1].ca - a[1].ca);
  const total = lignes.reduce((s, [, v]) => s + v.ca, 0);

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-medium">Origine des ventes</h2>
      <p className="mt-1 text-sm text-muted">
        D&apos;où venaient vos clientes la toute première fois qu&apos;elles
        sont arrivées sur le site.
      </p>

      {lignes.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Aucune vente pour l&apos;instant : l&apos;origine s&apos;affichera dès
          la première commande.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {lignes.map(([cle, v]) => {
            const part = total ? Math.round((v.ca / total) * 100) : 0;
            return (
              <div key={cle}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium">
                    {SOURCE_LABEL[cle as SourceVente] ?? cle}
                  </span>
                  <span className="text-muted">
                    {v.n} commande{v.n > 1 ? "s" : ""} ·{" "}
                    <span className="text-ink">
                      {formatPrice(v.ca, brand.currency, brand.locale)}
                    </span>{" "}
                    · {part}&nbsp;%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-halo">
                  <div
                    className="h-full rounded-full bg-ink"
                    style={{ width: `${Math.max(part, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
