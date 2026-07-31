"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import { useCart } from "@/lib/cart/store";
import { formatPrice, type Product } from "@/lib/products";
import { pixelTrack } from "@/lib/pixel-events";

const DEFAULT_VARIANT = { id: "standard", label: "Standard", priceDelta: 0, stock: 0 };

export default function AddToCart({ product }: { product: Product }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const close = useCart((s) => s.close);
  const variants = product.variants.length ? product.variants : [DEFAULT_VARIANT];
  const [variantId, setVariantId] = useState(variants[0].id);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const unitPrice = product.price + variant.priceDelta;
  const managed = product.manageStock === true;
  const inStock = managed ? variant.stock > 0 : true;

  const addLine = () => {
    add({
      slug: product.slug,
      name: product.name,
      variantId: variant.id,
      variantLabel: variant.label,
      unitPrice,
      image: product.images[0],
    });
    pixelTrack("AddToCart", {
      value: unitPrice / 100,
      items: [
        {
          id: product.slug,
          name: product.name,
          category: product.collection,
          price: unitPrice / 100,
          quantity: 1,
        },
      ],
    });
  };

  const handleAdd = () => {
    addLine();
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const handleBuyNow = () => {
    addLine();
    close();
    router.push("/checkout");
  };

  return (
    <div>
      <div className="mb-6">
        <p className="mb-3 text-sm font-medium text-muted">Finition</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const active = v.id === variantId;
            return (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                disabled={v.stock === 0}
                className={`rounded-full border px-4 py-2 text-sm transition-all disabled:opacity-40 ${
                  active
                    ? "border-primary bg-halo/40 text-ink shadow-glow"
                    : "border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                {v.label}
                {v.priceDelta > 0 && (
                  <span className="ml-1 text-xs text-muted">
                    +{formatPrice(v.priceDelta, brand.currency, brand.locale)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="font-heading text-3xl">
          {formatPrice(unitPrice, brand.currency, brand.locale)}
        </span>
        {managed && (
          <span
            className={`text-sm ${inStock ? "text-organic" : "text-secondary"}`}
          >
            {inStock ? `En stock · ${variant.stock} pièces` : "Épuisé"}
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={handleAdd}
          disabled={!inStock}
          className="w-full rounded-full border border-ink bg-transparent py-4 text-sm font-medium text-ink transition-all hover:scale-[0.99] hover:bg-ink hover:text-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? "Ajouté au panier ✓" : "Ajouter au panier"}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={!inStock}
          className="w-full rounded-full bg-primary py-4 text-sm font-medium text-ink transition-all hover:scale-[0.99] hover:bg-primary-dark hover:text-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Acheter maintenant
        </button>
      </div>
    </div>
  );
}
