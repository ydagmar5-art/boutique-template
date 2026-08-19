"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import { useCart } from "@/lib/cart/store";
import { formatPrice, type Product } from "@/lib/products";
import Price from "@/components/shop/Price";
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
      {/*
        Registre « Galerie » : angles droits, petites capitales espacées, un
        seul bouton plein. Le modèle livrait deux boutons en contour à angles
        arrondis — sur mobile, en pleine largeur, aucune action ne ressortait
        et le vocabulaire jurait avec le reste du site.
      */}
      <div className="mb-7">
        <p className="mb-3 text-[0.62rem] uppercase tracking-[0.22em] text-muted">
          {brand.variantLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const active = v.id === variantId;
            return (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                disabled={v.stock === 0}
                className={`border px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.14em] transition-colors disabled:opacity-40 ${
                  active
                    ? "border-ink bg-ink text-bg"
                    : "border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                {v.label}
                {v.priceDelta > 0 && (
                  <span className="ml-1.5 normal-case tracking-normal text-muted">
                    +{formatPrice(v.priceDelta, brand.currency, brand.locale)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-baseline gap-4 border-t border-line pt-6">
        {/* Le prix barré suit la variante : un supplément de coloris décale
            les deux montants du même écart, sinon la remise afficherait un
            pourcentage faux. */}
        <Price
          prix={unitPrice}
          prixBarre={
            product.compareAtPrice
              ? product.compareAtPrice + variant.priceDelta
              : undefined
          }
          taille="grand"
          remise
        />
        {managed && (
          <span
            className={`text-[0.7rem] ${inStock ? "text-organic" : "text-secondary"}`}
          >
            {inStock ? `En stock · ${variant.stock} pièces` : "Épuisé"}
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={handleAdd}
          disabled={!inStock}
          className="w-full bg-ink py-[1.05rem] text-[0.66rem] uppercase tracking-[0.22em] text-bg transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? "Ajouté au panier" : "Ajouter au panier"}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={!inStock}
          /*
            ⚠️ Était `bg-primary text-ink` : sur une palette où `primary`
            VAUT `ink` (marque monochrome), le libellé sortait noir sur noir.
            Un bouton en contour ne dépend d'aucune relation entre deux
            couleurs de la palette — il reste lisible quelle qu'elle soit.
          */
          className="w-full border border-ink bg-bg py-[1.05rem] text-[0.66rem] uppercase tracking-[0.22em] text-ink transition-colors hover:bg-ink hover:text-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Acheter maintenant
        </button>
      </div>
    </div>
  );
}
