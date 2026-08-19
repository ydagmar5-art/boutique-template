import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import { listVisibleProducts } from "@/lib/actions/products";
import CollectionBrowser from "@/components/shop/CollectionBrowser";
import FrenchMark from "@/components/site/FrenchMark";
import JsonLd from "@/components/site/JsonLd";
import { collectionJsonLd, filArianeJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/products" },
  title: "La collection",
  description: `Tous les sacs ${brand.name} : cabas, seaux, portés épaule, portés main et petits formats.`,
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listVisibleProducts();

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
      <JsonLd donnees={collectionJsonLd(products)} />
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: "Accueil", url: "/" },
          { nom: "La collection", url: "/products" },
        ])}
      />
      {/*
        ⚠️ Ne JAMAIS annoncer ici un nombre de modèles ni une amplitude de
        prix : le catalogue bouge au gré de la production des ateliers, et
        une page qui promet « 26 sacs » se contredit au premier retrait.
      */}
      <header className="max-w-2xl">
        <FrenchMark label="La collection · Maison française" />
        <h1 className="mt-4 font-heading text-4xl font-light leading-tight md:text-5xl">
          Chaque pièce a mérité sa place.
        </h1>
        <p className="mt-5 leading-[1.8] text-muted">
          Nous sortons peu de modèles, et chacun dans la seule teinte qui
          rendait justice à sa ligne. Un cuir choisi pour ce qu&apos;il
          deviendra dans cinq ans, pas pour son éclat le premier jour.
        </p>
      </header>

      <CollectionBrowser products={products} />
    </div>
  );
}
