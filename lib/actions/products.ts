"use server";

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";
import { seedProducts, type Product } from "@/lib/products";

const KEY = "products";

export async function listProducts(): Promise<Product[]> {
  return read<Product[]>(KEY, seedProducts);
}

export async function listFeatured(): Promise<Product[]> {
  return (await listProducts()).filter((p) => p.featured);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await listProducts()).find((p) => p.slug === slug);
}

export async function saveProduct(input: Product): Promise<{ slug: string }> {
  const products = await listProducts();
  const idx = products.findIndex((p) => p.slug === input.slug);
  if (idx >= 0) products[idx] = input;
  else products.unshift(input);
  await write(KEY, products);
  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath(`/products/${input.slug}`);
  return { slug: input.slug };
}

export async function deleteProduct(slug: string): Promise<void> {
  const products = (await listProducts()).filter((p) => p.slug !== slug);
  await write(KEY, products);
  revalidatePath("/products");
  revalidatePath("/admin/products");
}
