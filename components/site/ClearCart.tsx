"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/store";

/** Vide le panier une fois (page de confirmation de commande). */
export default function ClearCart() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
