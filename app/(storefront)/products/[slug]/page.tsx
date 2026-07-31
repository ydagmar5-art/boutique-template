import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { seedProducts } from "@/lib/products";
import { getProduct } from "@/lib/actions/products";
import AddToCart from "@/components/shop/AddToCart";
import Reassurances from "@/components/site/Reassurances";
import PaymentBadges from "@/components/site/PaymentBadges";

export const dynamicParams = true;

export function generateStaticParams() {
  return seedProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Produit introuvable" };
  return { title: product.name, description: product.tagline };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 md:py-16">
      <nav className="mb-8 text-sm text-muted">
        <Link href="/products" className="hover:text-ink">
          Collection
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-12 md:grid-cols-2">
        {/* Galerie */}
        <div className="space-y-4">
          <div className="grain overflow-hidden rounded-[2rem] bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images[0]}
              alt={product.name}
              loading="eager"
              decoding="async"
              width={900}
              height={1125}
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
          {product.images[1] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[1]}
              alt={`${product.name} détail`}
              loading="lazy"
              decoding="async"
              width={900}
              height={563}
              className="aspect-[16/10] w-full rounded-2xl object-cover"
            />
          )}
        </div>

        {/* Infos */}
        <div className="md:py-4">
          <span className="text-sm font-medium uppercase tracking-widest text-primary-dark">
            {product.collection}
          </span>
          <h1 className="mt-2 font-heading text-5xl">{product.name}</h1>
          <p className="mt-2 text-lg text-muted">{product.tagline}</p>

          {/* Preuve sociale */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-primary" aria-label="Noté 5 sur 5">
              ★★★★★
            </span>
            <span className="text-sm text-muted">Coup de cœur des clients</span>
          </div>

          <p className="mt-6 leading-relaxed text-ink/80">
            {product.description}
          </p>

          {/* Bénéfices clés */}
          <ul className="mt-6 space-y-2 text-sm">
            {[
              "Une pièce sculpturale qui devient le point focal de la pièce",
              "Lumière chaude et enveloppante, parfaite pour créer une ambiance",
              "Matières nobles, fabrication soignée pour durer dans le temps",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2 text-ink/80">
                <span className="mt-0.5 text-primary-dark">✓</span>
                {b}
              </li>
            ))}
          </ul>

          <dl className="mt-8 grid grid-cols-2 gap-y-4 border-y border-line py-6 text-sm">
            <dt className="text-muted">Matières</dt>
            <dd className="text-right">{product.material}</dd>
            <dt className="text-muted">{brand.productDetailLabel}</dt>
            <dd className="text-right">{product.detail}</dd>
          </dl>

          <div className="mt-8">
            <AddToCart product={product} />
          </div>

          {/* Réassurances */}
          <div className="mt-8">
            <Reassurances variant="compact" />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted">Paiement sécurisé :</span>
              <PaymentBadges />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
