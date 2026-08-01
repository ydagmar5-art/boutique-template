import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import { listVisibleProducts } from "@/lib/actions/products";
import CollectionBrowser from "@/components/shop/CollectionBrowser";

export const metadata: Metadata = {
  title: "Collection",
  description: `Découvrez toute la collection ${brand.name}.`,
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listVisibleProducts();

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
      <header className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-widest text-primary-dark">
          La collection
        </p>
        <h1 className="mt-2 font-heading text-5xl md:text-6xl">
          Des lampes qui font la lumière
        </h1>
        <p className="mt-4 text-lg text-muted">
          {products.length} pièces, chacune pensée pour réchauffer un intérieur.
        </p>
      </header>

      <CollectionBrowser products={products} />
    </div>
  );
}
