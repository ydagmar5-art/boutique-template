"use server";

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";
import { seedProducts, type Product } from "@/lib/products";

const KEY = "products";

/** Tout le catalogue, produits masqués compris. Réservé au back-office. */
export async function listProducts(): Promise<Product[]> {
  return read<Product[]>(KEY, seedProducts);
}

/** Le catalogue tel que le client le voit : sans les produits masqués. */
export async function listVisibleProducts(): Promise<Product[]> {
  return (await listProducts()).filter((p) => !p.hidden);
}

export async function listFeatured(): Promise<Product[]> {
  return (await listVisibleProducts()).filter((p) => p.featured);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await listProducts()).find((p) => p.slug === slug);
}

/** Fiche produit côté boutique : un produit masqué est traité comme inexistant. */
export async function getVisibleProduct(
  slug: string,
): Promise<Product | undefined> {
  const product = await getProduct(slug);
  return product?.hidden ? undefined : product;
}

export async function saveProduct(input: Product): Promise<{ slug: string }> {
  const products = await listProducts();
  const idx = products.findIndex((p) => p.slug === input.slug);
  if (idx >= 0) products[idx] = input;
  else products.unshift(input);
  await write(KEY, products);
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath(`/products/${input.slug}`);
  return { slug: input.slug };
}

/** Bascule l'affichage d'un produit dans la boutique. Renvoie son nouvel état. */
export async function toggleProductHidden(slug: string): Promise<boolean> {
  const products = await listProducts();
  const target = products.find((p) => p.slug === slug);
  if (!target) return false;
  target.hidden = !target.hidden;
  await write(KEY, products);
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/products");
  return !!target.hidden;
}

export async function deleteProduct(slug: string): Promise<void> {
  const products = (await listProducts()).filter((p) => p.slug !== slug);
  await write(KEY, products);
  revalidatePath("/products");
  revalidatePath("/admin/products");
}
