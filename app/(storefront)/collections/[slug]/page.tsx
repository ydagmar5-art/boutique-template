import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LIGNES, ligneParSlug } from "@/lib/collections";
import { listVisibleProducts } from "@/lib/actions/products";
import ProductCard from "@/components/shop/ProductCard";
import JsonLd from "@/components/site/JsonLd";
import { absolu, filArianeJsonLd } from "@/lib/seo";
import { brand } from "@/config/brand.config";

/**
 * Page de ligne — la page de catégorie qui manquait au référencement.
 *
 * ⚠️ L'ORDRE DES PRODUITS EST CELUI DU CATALOGUE, sans tri : le gérant l'a
 * réglé à la main dans le back-office (HANDOFF §2). Ne jamais y ajouter un
 * classement par prix ou par nom.
 */

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return LIGNES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ligne = ligneParSlug(slug);
  if (!ligne) return { title: "Ligne introuvable" };
  return {
    title: ligne.titreSeo,
    description: ligne.description,
    alternates: { canonical: `/collections/${ligne.slug}` },
    openGraph: {
      type: "website",
      title: `${ligne.titreSeo} | ${brand.name}`,
      description: ligne.description,
      url: absolu(`/collections/${ligne.slug}`),
    },
  };
}

export default async function LignePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ligne = ligneParSlug(slug);
  if (!ligne) notFound();

  const tous = await listVisibleProducts();
  const produits = tous.filter((p) => p.collection === ligne.nom);
  if (produits.length === 0) notFound();

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
      <JsonLd
        donnees={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: ligne.titreSeo,
          description: ligne.description,
          url: absolu(`/collections/${ligne.slug}`),
          inLanguage: brand.locale,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: produits.length,
            itemListElement: produits.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absolu(`/products/${p.slug}`),
              name: p.name,
            })),
          },
        }}
      />
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: "Accueil", url: "/" },
          { nom: "La collection", url: "/products" },
          { nom: ligne.h1, url: `/collections/${ligne.slug}` },
        ])}
      />

      <nav className="mb-8 text-sm text-muted">
        <Link href="/products" className="hover:text-ink">
          Collection
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{ligne.h1}</span>
      </nav>

      <header className="max-w-2xl">
        <h1 className="font-heading text-4xl font-light md:text-5xl">
          {ligne.h1}
        </h1>
        {ligne.intro.map((par) => (
          <p key={par.slice(0, 24)} className="mt-6 text-sm leading-[1.8] text-muted">
            {par}
          </p>
        ))}
      </header>

      <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
        {produits.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

      {/* Maillage entre lignes : chaque page de catégorie pointe vers les autres. */}
      <nav className="mt-20 border-t border-line pt-10">
        <h2 className="text-[0.72rem] uppercase tracking-[0.16em] text-muted">
          Les autres lignes
        </h2>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {LIGNES.filter((l) => l.slug !== ligne.slug).map((l) => (
            <li key={l.slug}>
              <Link
                href={`/collections/${l.slug}`}
                className="border-b border-ink pb-0.5 text-sm text-ink hover:opacity-60"
              >
                {l.h1}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
