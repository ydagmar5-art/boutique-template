"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import ProductCard from "./ProductCard";

export default function CollectionBrowser({ products }: { products: Product[] }) {
  const collections = useMemo(
    () => ["Tout", ...Array.from(new Set(products.map((p) => p.collection)))],
    [products],
  );
  const [active, setActive] = useState("Tout");

  const visible =
    active === "Tout"
      ? products
      : products.filter((p) => p.collection === active);

  return (
    <>
      <div className="mt-10 flex flex-wrap gap-2">
        {collections.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              active === c
                ? "border-primary bg-halo/40 text-ink"
                : "border-line text-muted hover:border-ink hover:text-ink"
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
        <p className="mt-12 text-center text-muted">Aucun produit dans cette collection.</p>
      )}
    </>
  );
}
