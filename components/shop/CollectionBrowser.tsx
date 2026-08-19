"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Product } from "@/lib/products";
import ProductCard from "./ProductCard";

/**
 * Grille de collection avec filtre par ligne.
 *
 * Le filtre initial peut venir de l'URL (`/products?collection=Cabas`) : sans
 * ça, les liens « par ligne » de l'accueil et du menu retomberaient tous sur
 * la même page non filtrée. Une valeur inconnue est ignorée et on affiche
 * tout, plutôt qu'une grille vide.
 */
export default function CollectionBrowser({ products }: { products: Product[] }) {
  const collections = useMemo(
    () => ["Tout", ...Array.from(new Set(products.map((p) => p.collection)))],
    [products],
  );
  const requested = useSearchParams().get("collection");
  const [active, setActive] = useState(() =>
    requested && collections.includes(requested) ? requested : "Tout",
  );

  const visible =
    active === "Tout"
      ? products
      : products.filter((p) => p.collection === active);

  return (
    <>
      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-b border-line pb-5">
        {collections.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`text-[0.7rem] uppercase tracking-[0.18em] transition ${
              active === c
                ? "text-ink underline decoration-1 underline-offset-[6px]"
                : "text-muted hover:text-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-12 text-center text-muted">Aucun sac dans cette ligne.</p>
      )}
    </>
  );
}
