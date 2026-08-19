"use server";

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";

const KEY = "categories";
/**
 * Les lignes du catalogue. ⚠️ Doivent correspondre aux `collection` de
 * `lib/products.ts` — c'est la liste proposée dans le back-office quand on
 * crée un produit, et celle qui alimente le filtre de la page collection.
 * ⚠️ `read()` ne re-seede que si la clé est ABSENTE en base : pour rejouer
 * ce seed après modification, supprimer la clé `categories` dans `romy_kv`.
 */
const SEED = ["Cabas", "Seau", "Épaule", "Porté main", "Petits formats"];

export async function listCategories(): Promise<string[]> {
  return read<string[]>(KEY, SEED);
}

export async function addCategory(name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const cats = await listCategories();
  if (!cats.some((c) => c.toLowerCase() === clean.toLowerCase())) {
    cats.push(clean);
    await write(KEY, cats);
    revalidatePath("/admin/categories");
    revalidatePath("/products");
  }
}

export async function deleteCategory(name: string): Promise<void> {
  const cats = (await listCategories()).filter((c) => c !== name);
  await write(KEY, cats);
  revalidatePath("/admin/categories");
  revalidatePath("/products");
}
