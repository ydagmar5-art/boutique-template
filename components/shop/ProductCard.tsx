import Link from "next/link";
import Image from "next/image";
import { brand } from "@/config/brand.config";
import { type Product } from "@/lib/products";
import Price from "@/components/shop/Price";

/**
 * Vignette de collection.
 *
 * ⚠️ Cadre 4/5 en `object-cover` : la 1re image d'un produit est le plan de
 * FACE, la 2e le plan à 3/4. C'est cet ordre qui fait le fondu au survol —
 * on tourne autour du sac, on ne change pas de sujet.
 *
 * ⚠️ `next/image` et pas `<img>` : les fichiers source font 1200 px de large
 * pour la fiche produit, alors qu'une vignette s'affiche autour de 350 px.
 * Servir la source brute, deux fois par carte, chargeait plusieurs mégaoctets
 * par page de collection. `sizes` laisse le navigateur réclamer la largeur
 * réellement utile.
 */
const SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export default function ProductCard({ product }: { product: Product }) {
  const face = product.images[0];
  const troisQuarts = product.images[1];

  return (
    <Link href={`/products/${product.slug}`} className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        <Image
          src={face}
          alt={product.name}
          fill
          sizes={SIZES}
          className="object-cover transition-opacity duration-700 ease-out group-hover:opacity-0"
        />
        {troisQuarts && (
          <Image
            src={troisQuarts}
            alt=""
            aria-hidden
            fill
            sizes={SIZES}
            className="object-cover opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
          />
        )}
      </div>
      <div className="pt-4">
        <h3 className="font-heading text-[0.78rem] uppercase tracking-[0.18em] text-ink">
          {product.name}
        </h3>
        <p className="mt-1.5 text-[0.78rem] leading-snug text-muted">
          {product.tagline}
        </p>
        <p className="mt-2">
          <Price prix={product.price} prixBarre={product.compareAtPrice} taille="petit" />
        </p>
      </div>
    </Link>
  );
}
