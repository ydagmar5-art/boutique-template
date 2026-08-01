import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { store } from "@/config/store.config";
import { hasSupabase, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Stockage des fichiers uploadés depuis le back-office (photos produit).
 *
 * - Supabase configuré : bucket public `media` (durable, servi par le CDN
 *   Supabase). C'est le seul mode qui fonctionne en production — sur Vercel le
 *   disque est en lecture seule.
 * - Sinon (dev local) : `public/uploads`, servi directement par Next.
 *
 * Même logique de repli que `lib/db/store.ts` : l'appelant n'a pas à savoir
 * lequel des deux est actif.
 */

/**
 * ⚠️ Bucket PRÉFIXÉ par boutique, comme les tables : le projet Supabase est
 * partagé, et un bucket commun ferait apparaître les photos d'une boutique
 * dans le back-office d'une autre.
 */
const BUCKET = `${store.prefix}-media`;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Nom de fichier sûr et unique : pas de collision, pas de caractère exotique. */
function safeName(original: string): string {
  const ext = (path.extname(original) || ".webp").toLowerCase().slice(0, 8);
  const base = path
    .basename(original, path.extname(original))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "image"}-${randomBytes(4).toString("hex")}${ext}`;
}

let bucketReady = false;

/** Crée le bucket public au premier upload — évite une étape de config manuelle. */
async function ensureBucket() {
  if (bucketReady) return;
  const sb = supabaseAdmin();
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/webp", "image/jpeg", "image/png", "image/avif", "image/gif"],
    });
  }
  bucketReady = true;
}

/** Enregistre un fichier et renvoie son URL publique. */
export async function saveMedia(
  bytes: ArrayBuffer,
  originalName: string,
  contentType: string,
): Promise<string> {
  const name = safeName(originalName);

  if (hasSupabase()) {
    await ensureBucket();
    const sb = supabaseAdmin();
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(name, bytes, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(bytes));
  return `/uploads/${name}`;
}
