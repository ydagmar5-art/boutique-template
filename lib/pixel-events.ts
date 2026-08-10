"use client";

/* Déclenche les événements de conversion sur tous les pixels chargés
   (Meta, TikTok, Snap, Pinterest, Google, Taboola) s'ils sont présents. */

type PixelEvent = "AddToCart" | "InitiateCheckout" | "Purchase";

/** Un article envoyé aux régies. Prix unitaire en euros. */
export interface PixelLineItem {
  /** Identifiant catalogue — ici, le slug du produit. */
  id: string;
  name?: string;
  /** Catégorie produit — ici, la collection du produit. */
  category?: string;
  price?: number;
  quantity?: number;
}

interface EventData {
  value?: number; // en euros
  currency?: string;
  /** Référence de commande : Pinterest s'en sert pour dédupliquer les achats. */
  orderId?: string;
  items?: PixelLineItem[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Enhanced match Pinterest : rattache la conversion au compte Pinterest du
 * client, ce qui améliore nettement l'attribution. L'e-mail est haché en
 * SHA-256 dans le navigateur — Pinterest ne reçoit jamais l'adresse en clair.
 * À appeler AVANT l'événement pour que la donnée y soit rattachée.
 */
export async function pixelIdentify(email: string) {
  if (typeof window === "undefined" || !email) return;
  const w = window as any;
  try {
    const bytes = new TextEncoder().encode(email.trim().toLowerCase());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hashed = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    w.pintrk?.("set", { em: hashed });
  } catch {}
}

export function pixelTrack(event: PixelEvent, data: EventData = {}) {
  if (typeof window === "undefined") return;
  const w = window as any;
  const value = data.value;
  const currency = data.currency ?? "EUR";
  const items = data.items ?? [];
  const ids = items.map((it) => it.id);
  // Quantité réelle de la commande (et non 1 en dur).
  const quantity = items.reduce((n, it) => n + (it.quantity ?? 1), 0) || 1;
  const money = value != null ? { value, currency } : {};

  try {
    w.fbq?.("track", event, {
      ...money,
      ...(ids.length
        ? { content_ids: ids, content_type: "product", num_items: quantity }
        : {}),
    });
  } catch {}
  try {
    const ttEvent = event === "Purchase" ? "CompletePayment" : event;
    w.ttq?.track?.(ttEvent, {
      ...money,
      ...(items.length
        ? {
            contents: items.map((it) => ({
              content_id: it.id,
              content_name: it.name,
              content_category: it.category,
              content_type: "product",
              price: it.price,
              quantity: it.quantity ?? 1,
            })),
          }
        : {}),
    });
  } catch {}
  try {
    const snapEvent =
      event === "Purchase" ? "PURCHASE" : event === "AddToCart" ? "ADD_CART" : "START_CHECKOUT";
    w.snaptr?.("track", snapEvent, {
      ...(value != null ? { price: value, currency } : {}),
      ...(ids.length ? { item_ids: ids, number_items: quantity } : {}),
      ...(data.orderId ? { transaction_id: data.orderId } : {}),
    });
  } catch {}
  try {
    // Pinterest : événements standards (addtocart / checkout).
    const pinEvent =
      event === "Purchase" ? "checkout" : event === "AddToCart" ? "addtocart" : "custom";
    const pinData: Record<string, unknown> = { ...money, order_quantity: quantity };
    if (data.orderId) pinData.order_id = data.orderId;
    if (items.length) {
      pinData.line_items = items.map((it) => ({
        product_id: it.id,
        ...(it.name ? { product_name: it.name } : {}),
        ...(it.category ? { product_category: it.category } : {}),
        ...(it.price != null ? { product_price: it.price } : {}),
        product_quantity: it.quantity ?? 1,
      }));
    }
    w.pintrk?.("track", pinEvent, pinData);
  } catch {}
  try {
    const gaItems = items.map((it) => ({
      item_id: it.id,
      item_name: it.name,
      item_category: it.category,
      price: it.price,
      quantity: it.quantity ?? 1,
    }));
    const gaData = {
      value,
      currency,
      ...(data.orderId ? { transaction_id: data.orderId } : {}),
      ...(gaItems.length ? { items: gaItems } : {}),
    };
    if (event === "Purchase") w.gtag?.("event", "purchase", gaData);
    else w.gtag?.("event", event.toLowerCase(), gaData);
  } catch {}
  try {
    /*
      Google Ads ne compte PAS l'événement `purchase` de GA4 : il lui faut son
      propre événement `conversion` adressé à `send_to`. Sans ce bloc, la régie
      voit les clics mais aucune vente — et les enchères automatiques ne
      peuvent rien optimiser.

      `transaction_id` est ce qui permet à Google d'écarter les doublons quand
      la page de confirmation est rechargée ou partagée.
    */
    const sendTo = w.__pxGoogleAdsSendTo;
    if (event === "Purchase" && sendTo) {
      w.gtag?.("event", "conversion", {
        send_to: sendTo,
        ...money,
        ...(data.orderId ? { transaction_id: data.orderId } : {}),
      });
    }
  } catch {}
  try {
    if (event === "Purchase") w._tfa?.push({ notify: "event", name: "purchase", revenue: value });
  } catch {}
}
