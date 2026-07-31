import "server-only";
import { acquireLock, read, releaseLock } from "@/lib/db/store";

/**
 * Garde-fou commun à TOUS les PSP : une commande, un paiement.
 *
 * Chaque passerelle nous prévient deux fois d'un paiement réussi — une fois par
 * le navigateur qui revient sur le site, une fois par son webhook serveur. Les
 * deux arrivent souvent à quelques millisecondes d'écart. Sans verrou, les deux
 * lisent le brouillon « pas encore traité » et créent chacun une commande.
 * (C'est exactement ce qui a produit deux commandes pour un seul
 * encaissement Fondy en juillet 2026.)
 *
 * @param lockName  identifiant unique du paiement (jamais de l'utilisateur)
 * @param pendingKey clé du brouillon, pour retrouver la commande si un autre
 *                   appel a déjà pris le verrou
 * @param create    crée la commande et marque le brouillon comme traité ;
 *                  renvoie l'identifiant de la commande
 */
export async function createOrderOnce(
  lockName: string,
  pendingKey: string,
  create: () => Promise<string>,
): Promise<{ orderId?: string; pending?: true }> {
  if (!(await acquireLock(lockName))) {
    // Quelqu'un d'autre finalise : on attend qu'il ait écrit la commande
    // plutôt que d'en créer une seconde.
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const p = await read<{ done?: boolean; orderId?: string | null } | null>(
        pendingKey,
        null,
      );
      if (p?.done && p.orderId) return { orderId: p.orderId };
    }
    return { pending: true };
  }

  try {
    return { orderId: await create() };
  } catch (e) {
    // Échec : on rend le verrou, sinon le paiement ne pourrait plus jamais
    // être transformé en commande (ni par le webhook, ni par un rechargement).
    await releaseLock(lockName);
    throw e;
  }
}
