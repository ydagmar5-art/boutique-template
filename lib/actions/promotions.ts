"use server";

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";
import { validateCart } from "@/lib/payments/cart";
import type { AppliedDiscount, Promotion } from "@/lib/promotions";
import type { OrderItem } from "@/lib/db/seed";

const KEY = "promotions";

export async function listPromotions(): Promise<Promotion[]> {
  return read<Promotion[]>(KEY, []);
}

/**
 * Récapitulatif du panier pour l'AFFICHAGE au paiement : sous-total, remises
 * retenues, total à payer et refus éventuel du code saisi.
 *
 * Le montant réellement débité est recalculé au moment d'encaisser — cette
 * fonction sert à montrer au client la même chose que ce qu'il va payer.
 */
export async function quoteCart(
  items: OrderItem[],
  code?: string,
): Promise<{
  subtotal?: number;
  total?: number;
  discounts?: AppliedDiscount[];
  codeError?: string;
  error?: string;
}> {
  const { cart, error } = await validateCart(items, code);
  if (error || !cart) return { error };
  return {
    subtotal: cart.subtotal,
    total: cart.total,
    discounts: cart.discounts,
    codeError: cart.codeError,
  };
}

/** Offres réellement utilisables, dans l'ordre de création. */
export async function listActivePromotions(): Promise<Promotion[]> {
  return (await listPromotions()).filter((p) => p.enabled);
}

export async function savePromotion(input: Promotion): Promise<{ id: string }> {
  const all = await listPromotions();
  const idx = all.findIndex((p) => p.id === input.id);
  // `usageCount` appartient au moteur, pas au formulaire : on ne le laisse
  // jamais être réécrit depuis le back-office.
  const kept = idx >= 0 ? all[idx].usageCount ?? 0 : 0;
  const clean: Promotion = { ...input, usageCount: kept };

  if (idx >= 0) all[idx] = clean;
  else all.unshift(clean);

  await write(KEY, all);
  revalidatePath("/admin/promotions");
  revalidatePath("/checkout");
  revalidatePath("/");
  return { id: clean.id };
}

export async function deletePromotion(id: string): Promise<void> {
  await write(KEY, (await listPromotions()).filter((p) => p.id !== id));
  revalidatePath("/admin/promotions");
  revalidatePath("/checkout");
  revalidatePath("/");
}

export async function togglePromotion(id: string): Promise<boolean> {
  const all = await listPromotions();
  const target = all.find((p) => p.id === id);
  if (!target) return false;
  target.enabled = !target.enabled;
  await write(KEY, all);
  revalidatePath("/admin/promotions");
  revalidatePath("/checkout");
  revalidatePath("/");
  return target.enabled;
}

/**
 * Incrémente le compteur d'utilisation des offres retenues.
 *
 * Appelé UNE SEULE FOIS par commande, depuis la création de commande — donc
 * derrière le verrou `createOrderOnce`, jamais à l'affichage du panier : sinon
 * un simple rechargement de page consommerait le quota d'un code.
 */
export async function countPromotionUse(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const all = await listPromotions();
  let touched = false;
  for (const id of ids) {
    const promo = all.find((p) => p.id === id);
    if (promo) {
      promo.usageCount = (promo.usageCount ?? 0) + 1;
      touched = true;
    }
  }
  if (touched) {
    await write(KEY, all);
    revalidatePath("/admin/promotions");
  }
}
