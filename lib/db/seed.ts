export type OrderStatus =
  | "paid"
  | "pending"
  | "shipped"
  | "refunded"
  | "cancelled";

export interface OrderItem {
  slug: string;
  name: string;
  /** Identifiant de la variante — sert à retrouver son prix côté serveur.
   *  Optionnel : les commandes enregistrées avant août 2026 n'en ont pas. */
  variantId?: string;
  variantLabel: string;
  unitPrice: number; // centimes
  qty: number;
}

export interface OrderTracking {
  /** Identifiant transporteur (voir CARRIERS dans lib/carriers.ts). */
  carrier: string;
  number: string;
}

export interface Order {
  id: string;
  customer: string;
  email: string;
  date: string; // ISO (yyyy-mm-dd ou complet)
  total: number; // centimes
  status: OrderStatus;
  psp: string;
  /** Téléphone du destinataire, pour le livreur. */
  phone?: string;
  /**
   * Référence de la transaction chez le PSP (`pi_…` chez Stripe, `int_…` chez
   * Airwallex). Sert à rapprocher une commande d'un encaissement et à lui
   * rattacher le suivi (cf. `lib/payments/tracking.ts`).
   */
  pspRef?: string;
  /**
   * Origine de la visiteuse à sa PREMIÈRE venue (cf. `lib/attribution.ts`).
   * Absent sur les commandes antérieures au 5 août 2026.
   */
  source?: string;
  items: OrderItem[];
  address?: string;
  /** Renseigné au passage en « expédiée » (facultatif). */
  tracking?: OrderTracking;
  /** Date ISO à laquelle le suivi a été transmis au PSP, si elle a abouti. */
  trackingSentAt?: string;
  /**
   * Commande traitée : masquée de la liste admin par défaut.
   * N'affecte NI les statistiques NI le chiffre d'affaires.
   */
  archived?: boolean;
  /** Total avant remise, présent seulement si une offre s'est appliquée. */
  subtotal?: number;
  /** Offre automatique et/ou code promo retenus sur cette commande. */
  discounts?: { promoId: string; label: string; amount: number; code?: string }[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  orders: number;
  spent: number;
}

export const seedOrders: Order[] = [
  // Volontairement VIDE : une boutique qui vient d'ouvrir ne doit pas
  // afficher de fausses commandes dans son back-office ni dans son CA.
];

export const seedCustomers: Customer[] = [
  // Volontairement VIDE — voir seedOrders.
];

export function statusLabel(s: OrderStatus) {
  return {
    paid: "Payée",
    pending: "En attente",
    shipped: "Expédiée",
    refunded: "Remboursée",
    cancelled: "Annulée",
  }[s];
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  paid: "bg-organic/15 text-organic",
  shipped: "bg-primary/15 text-primary-dark",
  pending: "bg-halo text-primary-dark",
  refunded: "bg-secondary/15 text-secondary",
  cancelled: "bg-secondary/15 text-secondary",
};
