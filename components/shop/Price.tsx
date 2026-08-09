import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AFFICHAGE DU PRIX, AVEC PRIX BARRÉ ÉVENTUEL                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * `prix` est TOUJOURS le montant réellement débité — celui que le serveur
 * recalcule depuis le catalogue (`lib/payments/cart.ts`). `prixBarre` n'est
 * qu'un affichage : il ne participe à aucun calcul, ne part dans aucun
 * paiement, et ne peut donc pas faire payer autre chose que le prix annoncé.
 *
 * ⚠️ LE PRIX BARRÉ EST ENCADRÉ PAR LA LOI. En France, le prix de référence
 * affiché lors d'une réduction doit être le prix le plus bas pratiqué dans
 * les 30 jours qui précèdent (art. L112-1-1 du code de la consommation,
 * transposition de la directive Omnibus). Inventer un « ancien prix » qui n'a
 * jamais été pratiqué est une pratique commerciale trompeuse — c'est aussi
 * l'un des motifs de fermeture les plus fréquents chez les prestataires de
 * paiement. Le back-office rappelle cette règle au moment de la saisie.
 *
 * ⚠️ Un prix barré INFÉRIEUR ou ÉGAL au prix courant n'est jamais affiché :
 * une remise de 0 % ou négative est au mieux une erreur de saisie, au pire
 * une tromperie.
 */
export default function Price({
  prix,
  prixBarre,
  taille = "normal",
  remise = false,
}: {
  /** Montant débité, en centimes. */
  prix: number;
  /** Ancien prix, en centimes. Ignoré s'il n'est pas strictement supérieur. */
  prixBarre?: number;
  taille?: "petit" | "normal" | "grand";
  /** Affiche le pourcentage de réduction à côté du prix. */
  remise?: boolean;
}) {
  const barre = prixBarre && prixBarre > prix ? prixBarre : null;
  const pourcent = barre ? Math.round(((barre - prix) / barre) * 100) : 0;

  const classes = {
    petit: { prix: "text-[0.8rem]", barre: "text-[0.72rem]", badge: "text-[0.62rem]" },
    normal: { prix: "text-[0.9rem]", barre: "text-[0.8rem]", badge: "text-[0.65rem]" },
    grand: {
      prix: "font-heading text-2xl font-light",
      barre: "text-base",
      badge: "text-[0.7rem]",
    },
  }[taille];

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className={`${classes.prix} ${barre ? "text-secondary" : "text-ink"}`}>
        {formatPrice(prix, brand.currency, brand.locale)}
      </span>
      {barre && (
        <>
          <s className={`${classes.barre} text-muted`}>
            {formatPrice(barre, brand.currency, brand.locale)}
          </s>
          {remise && pourcent > 0 && (
            <span
              className={`${classes.badge} whitespace-nowrap uppercase tracking-[0.12em] text-secondary`}
            >
              −{pourcent}&nbsp;%
            </span>
          )}
        </>
      )}
    </span>
  );
}
