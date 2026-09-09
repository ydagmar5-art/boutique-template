import { promises as fs } from "fs";
import { mediaPath, mediaType } from "@/lib/db/media";

/**
 * Sert les photos envoyées depuis le back-office.
 *
 * Elles sont stockées hors de l'arborescence déployée (voir `lib/db/media.ts`),
 * donc aucun serveur de fichiers statiques ne peut les atteindre : cette route
 * est le seul chemin d'accès.
 *
 * ⚠️ `force-static` serait faux ici — le dossier change après le build.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const full = mediaPath(decodeURIComponent(name));
  if (!full) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(full);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mediaType(full),
        /* Le nom porte un suffixe aléatoire : un fichier donné ne change
           jamais de contenu, on peut donc le figer un an dans les caches. */
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
