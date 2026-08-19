"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackEvent } from "@/lib/actions/analytics";
import { store } from "@/config/store.config";
import { detecterSource } from "@/lib/attribution";

/**
 * Origine retenue à la PREMIÈRE visite, puis figée. Voir l'avertissement en
 * tête de `lib/attribution.ts` : attribuer au dernier clic ferait remonter
 * « direct » sur presque toutes les ventes.
 */
const CLE_SOURCE = `${store.prefix}_src`;

export function memoriserSource(): void {
  try {
    if (localStorage.getItem(CLE_SOURCE)) return;
    const s = detecterSource(
      document.referrer || null,
      new URLSearchParams(window.location.search),
    );
    localStorage.setItem(CLE_SOURCE, s);
  } catch {
    /* navigation privée : on se passe d'attribution */
  }
}

export function sourceMemorisee(): string {
  try {
    return localStorage.getItem(CLE_SOURCE) ?? "direct";
  } catch {
    return "direct";
  }
}

function fireCartAdd(slug: string) {
  try {
    const vid = localStorage.getItem(store.cookies.visitor) || "anon";
    trackEvent("cart_add", slug, vid).catch(() => {});
  } catch {
    /* ignore */
  }
}

export interface CartLine {
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  unitPrice: number; // centimes
  image: string;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  remove: (slug: string, variantId: string) => void;
  setQty: (slug: string, variantId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
}

const keyOf = (slug: string, variantId: string) => `${slug}::${variantId}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      add: (line, qty = 1) =>
        set((state) => {
          fireCartAdd(line.slug);
          const k = keyOf(line.slug, line.variantId);
          const existing = state.lines.find(
            (l) => keyOf(l.slug, l.variantId) === k,
          );
          if (existing) {
            return {
              isOpen: true,
              lines: state.lines.map((l) =>
                keyOf(l.slug, l.variantId) === k
                  ? { ...l, qty: l.qty + qty }
                  : l,
              ),
            };
          }
          return { isOpen: true, lines: [...state.lines, { ...line, qty }] };
        }),
      remove: (slug, variantId) =>
        set((state) => ({
          lines: state.lines.filter(
            (l) => keyOf(l.slug, l.variantId) !== keyOf(slug, variantId),
          ),
        })),
      setQty: (slug, variantId, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              keyOf(l.slug, l.variantId) === keyOf(slug, variantId)
                ? { ...l, qty: Math.max(1, qty) }
                : l,
            )
            .filter((l) => l.qty > 0),
        })),
      clear: () => set({ lines: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: store.storage.cart,
      // Ne persister que le contenu du panier, jamais l'état d'ouverture du tiroir.
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

export const cartCount = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.qty, 0);

export const cartTotal = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
