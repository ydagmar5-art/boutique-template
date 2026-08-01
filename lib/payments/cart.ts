import "server-only";
import { listVisibleProducts } from "@/lib/actions/products";
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
  /** Total recalculé, en centimes. */
  total: number;
}

export async function validateCart(
  items: OrderItem[] | undefined,
): Promise<{ cart?: ValidatedCart; error?: string }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Votre panier est vide." };
  }

  const catalogue = await listVisibleProducts();
  const clean: OrderItem[] = [];

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

    clean.push({
      slug: product.slug,
      name: product.name,
      variantId: variant.id,
      variantLabel: variant.label,
      unitPrice: product.price + variant.priceDelta,
      qty,
    });
  }

  return {
    cart: {
      items: clean,
      total: clean.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),
    },
  };
}

/** Total du panier recalculé côté serveur, sans reconstruire les lignes. */
export async function serverTotal(
  items: OrderItem[] | undefined,
): Promise<{ total?: number; error?: string }> {
  const { cart, error } = await validateCart(items);
  return cart ? { total: cart.total } : { error };
}
