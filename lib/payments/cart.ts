import "server-only";
import { listVisibleProducts } from "@/lib/actions/products";
import { listPromotions } from "@/lib/actions/promotions";
import { applyPromotions, type AppliedDiscount, type PromoLine } from "@/lib/promotions";
import type { OrderItem } from "@/lib/db/seed";

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  LE PANIER ENVOYÉ PAR LE NAVIGATEUR N'EST QU'UNE DEMANDE            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Les lignes du panier vivent dans le `localStorage` du client : nom, prix
 * unitaire et total y sont modifiables en trois clics dans une console. Sans
 * cette relecture, il suffisait d'éditer le total pour payer 1 € un panier à
 * 500 €, ou de commander un produit masqué resté au panier.
 *
 * Rien de ce qui vient du client n'est conservé sinon le **slug**, la
 * **variante** et la **quantité** : le nom, le prix et le total sont
 * systématiquement repris du catalogue.
 */

/** Garde-fou de saisie : au-delà, c'est une erreur ou un abus, pas une commande. */
const MAX_QTY = 99;

export interface ValidatedCart {
  /** Lignes reconstruites depuis le catalogue (prix serveur). */
  items: OrderItem[];
  /** Total à payer, remises déduites. En centimes. */
  total: number;
  /** Somme des articles avant remise. */
  subtotal: number;
  /** Remises retenues (offre automatique et/ou code promo). */
  discounts: AppliedDiscount[];
  /** Motif du refus du code saisi, à afficher au client. */
  codeError?: string;
}

export async function validateCart(
  items: OrderItem[] | undefined,
  /** Code promo saisi au paiement. */
  code?: string,
): Promise<{ cart?: ValidatedCart; error?: string }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Votre panier est vide." };
  }

  const catalogue = await listVisibleProducts();
  const clean: OrderItem[] = [];
  /** Lignes enrichies de leur catégorie, pour le ciblage des offres. */
  const promoLines: PromoLine[] = [];

  for (const line of items) {
    const qty = Number(line?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { error: "Quantité invalide." };
    }

    // Produit supprimé ou masqué depuis l'ajout au panier : il n'est plus
    // vendable, même s'il traîne encore dans le navigateur du client.
    const product = catalogue.find((p) => p.slug === line?.slug);
    if (!product) {
      return {
        error: `« ${line?.name ?? "Un article"} » n'est plus disponible. Merci de le retirer de votre panier.`,
      };
    }

    // On retrouve la variante par son identifiant ; le libellé ne sert que de
    // repli pour les paniers ouverts avant que l'identifiant soit transmis.
    const variant =
      product.variants.find((v) => v.id === line?.variantId) ??
      product.variants.find((v) => v.label === line?.variantLabel) ??
      (product.variants.length === 1 ? product.variants[0] : undefined);
    if (!variant) {
      return {
        error: `La finition choisie pour « ${product.name} » n'existe plus.`,
      };
    }

    if (product.manageStock && variant.stock < qty) {
      return {
        error:
          variant.stock > 0
            ? `Il ne reste que ${variant.stock} exemplaire(s) de « ${product.name} ».`
            : `« ${product.name} » est en rupture de stock.`,
      };
    }

    const unitPrice = product.price + variant.priceDelta;
    clean.push({
      slug: product.slug,
      name: product.name,
      variantId: variant.id,
      variantLabel: variant.label,
      unitPrice,
      qty,
    });
    promoLines.push({
      slug: product.slug,
      name: product.name,
      collection: product.collection,
      unitPrice,
      qty,
    });
  }

  // Les offres sont appliquées ICI, après reconstruction des prix : une remise
  // calculée sur un panier non vérifié se contournerait aussi facilement qu'un
  // total falsifié.
  const totals = applyPromotions(promoLines, await listPromotions(), code);

  return {
    cart: {
      items: clean,
      subtotal: totals.subtotal,
      total: totals.total,
      discounts: [totals.auto, totals.promoCode].filter(
        (d): d is AppliedDiscount => !!d,
      ),
      codeError: totals.codeError,
    },
  };
}

/** Total à débiter, remises comprises. Sans reconstruire les lignes. */
export async function serverTotal(
  items: OrderItem[] | undefined,
  code?: string,
): Promise<{ total?: number; error?: string }> {
  const { cart, error } = await validateCart(items, code);
  return cart ? { total: cart.total } : { error };
}
