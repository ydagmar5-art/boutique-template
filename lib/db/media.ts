import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

/**
 * Stockage des fichiers uploadés depuis le back-office (photos produit).
 *
 * ⚠️ LE PIÈGE DE L'HÉBERGEMENT HOSTINGER. Le disque est inscriptible — mais
 * un déploiement (`hosting nodejs start-build`) REMPLACE tout le contenu du
 * site. Une photo écrite sous `public/` ou dans le dossier de l'application
 * disparaît donc à la mise en ligne suivante, sans avertissement, et les
 * fiches produit se retrouvent avec des images mortes.
 *
 * Les fichiers vivent donc HORS de l'arborescence déployée, dans le dossier
 * désigné par `MEDIA_DIR` — typiquement `/home/<compte>/media/<prefixe>`,
 * voisin de `domains/` et jamais touché par un déploiement. Ils sont servis
 * par la route `app/media/[name]/route.ts`, d'où l'URL `/media/<fichier>`.
 *
 * En développement, `MEDIA_DIR` non défini vaut `./media` à la racine du
 * projet : même chemin d'URL, même code, aucun cas particulier.
 */

export const MEDIA_DIR =
  process.env.MEDIA_DIR || path.join(process.cwd(), "media");

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

/** Enregistre un fichier et renvoie son URL publique. */
export async function saveMedia(
  bytes: ArrayBuffer,
  originalName: string,
  _contentType: string,
): Promise<string> {
  const name = safeName(originalName);
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, name), Buffer.from(bytes));
  return `/media/${name}`;
}

/**
 * Chemin absolu d'un média, ou `null` si le nom est refusé.
 *
 * ⚠️ Le nom vient de l'URL : sans ce filtre, `..%2F..%2Fetc%2Fpasswd` ferait
 * lire n'importe quel fichier du compte. On n'accepte donc qu'un nom plat,
 * et on revérifie APRÈS résolution que le chemin reste dans le dossier —
 * les deux contrôles sont nécessaires, le premier pouvant être contourné par
 * un encodage inattendu.
 */
export function mediaPath(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("\0")) return null;
  if (name === "." || name === "..") return null;
  const full = path.resolve(MEDIA_DIR, name);
  if (full !== path.join(path.resolve(MEDIA_DIR), name)) return null;
  return full;
}

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** Type MIME d'après l'extension — jamais d'après le fichier lui-même. */
export function mediaType(name: string): string {
  return TYPES[path.extname(name).toLowerCase()] || "application/octet-stream";
}
