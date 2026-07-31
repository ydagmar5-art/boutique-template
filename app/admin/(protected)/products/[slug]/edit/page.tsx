import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/actions/products";
import { listCategories } from "@/lib/actions/categories";
import ProductForm from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, categories] = await Promise.all([
    getProduct(slug),
    listCategories(),
  ]);
  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-muted hover:text-ink">
        ← Catalogue
      </Link>
      <h1 className="mb-8 mt-3 font-heading text-3xl">Modifier · {product.name}</h1>
      <div className="rounded-2xl border border-line bg-surface p-6">
        <ProductForm product={product} categories={categories} />
      </div>
    </div>
  );
}
