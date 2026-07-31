"use server";

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";

const KEY = "categories";
const SEED = ["Lampadaires", "Lampes à poser"];

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
