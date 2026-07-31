"use server";

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";
import { EMPTY_PIXELS, type PixelConfig } from "@/lib/pixels-types";

const KEY = "pixels";

export async function getPixels(): Promise<PixelConfig> {
  return { ...EMPTY_PIXELS, ...(await read<Partial<PixelConfig>>(KEY, {})) };
}

export async function savePixels(data: PixelConfig): Promise<{ ok: true }> {
  const clean: PixelConfig = { ...EMPTY_PIXELS };
  (Object.keys(clean) as (keyof PixelConfig)[]).forEach((k) => {
    clean[k] = String(data[k] || "").trim();
  });
  await write(KEY, clean);
  revalidatePath("/admin/pixels");
  revalidatePath("/", "layout");
  return { ok: true };
}
