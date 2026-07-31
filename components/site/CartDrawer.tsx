"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand.config";
import { useCart, cartTotal } from "@/lib/cart/store";
import { formatPrice } from "@/lib/products";

export default function CartDrawer() {
  const { lines, isOpen, close, setQty, remove } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted) return null;
  const total = cartTotal(lines);

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        onClick={close}
        className={`absolute inset-0 bg-ink/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-bg shadow-soft transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Panier"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-heading text-lg">Votre panier</h2>
          <button
            onClick={close}
            className="text-muted transition-colors hover:text-ink"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="inline-block h-3 w-3 animate-glow rounded-full bg-primary" />
            <p className="text-muted">Votre panier attend sa première lumière.</p>
            <Link
              href="/products"
              onClick={close}
              className="mt-2 text-sm font-medium text-primary-dark underline-offset-4 hover:underline"
            >
              Parcourir la collection
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {lines.map((l) => (
                <div
                  key={`${l.slug}-${l.variantId}`}
                  className="flex gap-4 border-b border-line py-4 last:border-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.image}
                    alt={l.name}
                    className="h-20 w-16 rounded-lg object-cover"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-muted">{l.variantLabel}</p>
                      </div>
                      <button
                        onClick={() => remove(l.slug, l.variantId)}
                        className="text-xs text-muted hover:text-secondary"
                      >
                        Retirer
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-line">
                        <button
                          onClick={() => setQty(l.slug, l.variantId, l.qty - 1)}
                          className="px-3 py-1 text-muted hover:text-ink"
                          aria-label="Diminuer"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm">{l.qty}</span>
                        <button
                          onClick={() => setQty(l.slug, l.variantId, l.qty + 1)}
                          className="px-3 py-1 text-muted hover:text-ink"
                          aria-label="Augmenter"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-medium">
                        {formatPrice(l.unitPrice * l.qty, brand.currency, brand.locale)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-muted">Sous-total</span>
                <span className="font-heading text-xl">
                  {formatPrice(total, brand.currency, brand.locale)}
                </span>
              </div>
              <Link
                href="/checkout"
                onClick={close}
                className="block w-full rounded-full bg-ink py-3.5 text-center text-sm font-medium text-bg transition-transform hover:scale-[0.99] hover:bg-primary-dark"
              >
                Passer au paiement
              </Link>
              <p className="mt-3 text-center text-xs text-muted">
                Livraison offerte · Paiement 100 % sécurisé
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
