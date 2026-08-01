"use server";

import { getSession } from "@/lib/auth/session";
import { saveMedia } from "@/lib/db/media";

/** 10 Mo : au-delà, c'est une photo non retouchée qui n'a rien à faire sur une fiche. */
const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadResult {
  url?: string;
  error?: string;
}

/**
 * Reçoit une image depuis le back-office et renvoie son URL publique.
 * Le navigateur redimensionne et convertit en WebP avant l'envoi — ici on ne
 * fait plus que valider et ranger.
 */
export async function uploadImage(form: FormData): Promise<UploadResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { error: "Session expirée — reconnectez-vous." };
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier reçu." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: `« ${file.name} » n'est pas une image.` };
  }
  if (file.size > MAX_BYTES) {
    return { error: `« ${file.name} » dépasse 10 Mo.` };
  }

  try {
    const url = await saveMedia(await file.arrayBuffer(), file.name, file.type);
    return { url };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "L'envoi a échoué.",
    };
  }
}
