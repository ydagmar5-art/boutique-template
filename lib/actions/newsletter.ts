"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  INSCRIPTION À LA LETTRE                                         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Enregistre l'adresse, puis envoie l'e-mail de bienvenue avec le code
 * promotionnel. Le code n'est pas « créé » ici : il vit dans le moteur
 * d'offres (`lib/actions/promotions.ts`, offre `bienvenue`) et y est validé
 * au paiement. Cette action ne fait que le communiquer.
 *
 * ⚠️ Fichier en `"use server"` : uniquement des fonctions async exportées.
 * Une constante exportée ici ferait échouer le build.
 */

import { read, write } from "@/lib/db/store";
import { sendNewsletterWelcome } from "@/lib/emails";
import { listPromotions } from "@/lib/actions/promotions";

const KEY = "newsletter";

interface Subscriber {
  email: string;
  date: string;
}

/** Validation volontairement souple : on refuse l'absurde, pas l'exotique. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function subscribeToNewsletter(
  emailRaw: string,
): Promise<{ ok?: true; already?: true; error?: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return { error: "Cette adresse e-mail ne semble pas valide." };
  }

  const list = await read<Subscriber[]>(KEY, []);

  // Déjà inscrite : on ne renvoie pas le code. Sans ce garde-fou, il suffirait
  // de resoumettre le formulaire pour se faire réexpédier l'e-mail en boucle,
  // ce qui abîmerait la réputation d'envoi du domaine.
  if (list.some((s) => s.email === email)) return { already: true };

  await write(KEY, [{ email, date: new Date().toISOString() }, ...list]);

  // Le code réellement actif, lu dans le moteur d'offres : annoncer un code
  // désactivé dans le back-office serait une promesse non tenue au paiement.
  const promo = (await listPromotions()).find(
    (p) => p.id === "bienvenue" && p.enabled && p.code,
  );
  if (promo?.code) {
    await sendNewsletterWelcome(email, promo.code.toUpperCase(), promo.percent ?? 10);
  }

  return { ok: true };
}
