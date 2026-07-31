"use client";
import { store } from "@/config/store.config";

import { useEffect, useRef } from "react";
import { pixelIdentify, pixelTrack, type PixelLineItem } from "@/lib/pixel-events";

/** Déclenche l'événement Purchase (une seule fois) sur la page de confirmation. */
export default function PurchasePixel({
  id,
  value,
  email,
  items,
}: {
  id: string;
  value: number;
  email?: string;
  items?: PixelLineItem[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    // Évite les doublons si la page est rechargée.
    try {
      const key = `${store.prefix}_purchase_${id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fired.current = true;
    const send = () => pixelTrack("Purchase", { value, orderId: id, items });
    // L'enhanced match doit être posé avant l'événement ; on part quand même
    // si le hachage échoue (navigateur sans crypto.subtle).
    if (email) pixelIdentify(email).then(send, send);
    else send();
  }, [id, value, email, items]);
  return null;
}
