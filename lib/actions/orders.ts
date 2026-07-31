"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/config/store.config";
import { read, write } from "@/lib/db/store";
import {
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrderTracking,
  type Customer,
} from "@/lib/db/seed";
import {
  sendOrderConfirmation,
  sendMerchantNewOrder,
  sendOrderShipped,
  sendOrderCancelled,
  sendOrderRefunded,
} from "@/lib/emails";

const ORDERS = "orders";
const CUSTOMERS = "customers";
// Boutique réelle : aucune donnée de démonstration. On démarre à vide.
const NO_ORDERS: Order[] = [];
const NO_CUSTOMERS: Customer[] = [];

export async function listOrders(): Promise<Order[]> {
  const orders = await read<Order[]>(ORDERS, NO_ORDERS);
  return [...orders].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getOrder(id: string): Promise<Order | undefined> {
  return (await read<Order[]>(ORDERS, NO_ORDERS)).find((o) => o.id === id);
}

export async function listCustomers(): Promise<Customer[]> {
  return read<Customer[]>(CUSTOMERS, NO_CUSTOMERS);
}

export interface NewOrderInput {
  customer: string;
  email: string;
  address?: string;
  items: OrderItem[];
  total: number;
  psp: string;
}

export async function createOrder(input: NewOrderInput): Promise<{ id: string }> {
  const orders = await read<Order[]>(ORDERS, NO_ORDERS);
  // ⚠️ Numéroter d'après le PLUS GRAND numéro attribué, jamais d'après le
  // NOMBRE de commandes : sinon toute suppression fait rejouer un numéro déjà
  // utilisé (deux CMD-1045 ont ainsi coexisté, rendant l'une des deux
  // inaccessible et impossible à supprimer séparément).
  const prefix: string = store.orders.prefix;
  const firstOrderNumber: number = store.orders.firstOrderNumber;
  const used = new Set(orders.map((o) => o.id));
  let num = orders.reduce((max, o) => {
    const n = Number.parseInt(o.id.replace(prefix, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, firstOrderNumber);
  let id = `${prefix}${++num}`;
  while (used.has(id)) id = `${prefix}${++num}`;
  const order: Order = {
    id,
    customer: input.customer,
    email: input.email,
    address: input.address,
    date: new Date().toISOString().slice(0, 10),
    total: input.total,
    // Paiement simulé tant que les PSP ne sont pas connectés.
    status: "paid",
    psp: input.psp,
    items: input.items,
  };
  orders.unshift(order);
  await write(ORDERS, orders);

  // Upsert client
  const customers = await read<Customer[]>(CUSTOMERS, NO_CUSTOMERS);
  const existing = customers.find((c) => c.email === input.email);
  if (existing) {
    existing.orders += 1;
    existing.spent += input.total;
  } else {
    customers.unshift({
      id: `c-${Date.now()}`,
      name: input.customer,
      email: input.email,
      orders: 1,
      spent: input.total,
    });
  }
  await write(CUSTOMERS, customers);

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");

  // E-mails : confirmation (paiement accepté) au client + notification au gérant.
  await Promise.allSettled([
    sendOrderConfirmation(order),
    sendMerchantNewOrder(order),
  ]);

  return { id };
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  tracking?: OrderTracking,
): Promise<void> {
  const orders = await read<Order[]>(ORDERS, NO_ORDERS);
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  const previous = o.status;
  o.status = status;
  // Suivi facultatif : on n'écrase pas un numéro déjà saisi par un envoi à vide.
  if (status === "shipped" && tracking?.number.trim()) {
    o.tracking = { carrier: tracking.carrier, number: tracking.number.trim() };
  }
  await write(ORDERS, orders);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  revalidatePath(`/order/${id}`);

  // E-mail automatique au client selon le nouveau statut (si changement réel).
  if (status !== previous) {
    if (status === "shipped") await sendOrderShipped(o);
    else if (status === "cancelled") await sendOrderCancelled(o);
    else if (status === "refunded") await sendOrderRefunded(o);
  }
}

/**
 * Ajoute ou corrige le suivi d'une commande déjà expédiée. `notify` renvoie
 * l'e-mail d'expédition au client (à décocher pour une simple faute de frappe).
 */
export async function setOrderTracking(
  id: string,
  tracking: OrderTracking,
  notify: boolean,
): Promise<void> {
  const orders = await read<Order[]>(ORDERS, NO_ORDERS);
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  const number = tracking.number.trim();
  if (number) o.tracking = { carrier: tracking.carrier, number };
  else delete o.tracking;
  await write(ORDERS, orders);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/order/${id}`);

  if (notify && number) await sendOrderShipped(o);
}

/** Archive (ou désarchive) des commandes traitées. Sans effet sur les stats. */
export async function setOrdersArchived(
  ids: string[],
  archived: boolean,
): Promise<void> {
  const set = new Set(ids);
  const orders = await read<Order[]>(ORDERS, NO_ORDERS);
  for (const o of orders) {
    if (set.has(o.id)) o.archived = archived;
  }
  await write(ORDERS, orders);
  revalidatePath("/admin/orders");
  for (const id of ids) revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
}

export async function ordersByEmail(email: string): Promise<Order[]> {
  return (await listOrders()).filter((o) => o.email === email);
}

export async function deleteOrder(id: string): Promise<void> {
  const orders = (await read<Order[]>(ORDERS, NO_ORDERS)).filter(
    (o) => o.id !== id,
  );
  await write(ORDERS, orders);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function deleteOrders(ids: string[]): Promise<void> {
  const set = new Set(ids);
  const orders = (await read<Order[]>(ORDERS, NO_ORDERS)).filter(
    (o) => !set.has(o.id),
  );
  await write(ORDERS, orders);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}
