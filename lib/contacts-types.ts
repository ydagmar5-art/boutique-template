/**
 * Types et constantes du carnet d'adresses.
 *
 * ⚠️ Fichier séparé de `lib/actions/contacts.ts` À DESSEIN : ce dernier est
 * en `"use server"`, et un tel fichier ne peut exporter QUE des fonctions
 * async. Y laisser `STATUT_LABEL` faisait échouer le build avec
 * « A "use server" file can only export async functions, found object ».
 * Même motif que `lib/pixels-types.ts`.
 */

export type ContactStatut = "cliente" | "inscrite" | "cliente-inscrite";

export interface Contact {
  email: string;
  nom: string;
  statut: ContactStatut;
  /** Nombre de commandes honorées. 0 pour une simple inscrite. */
  commandes: number;
  /** Total dépensé, en centimes. */
  depense: number;
  /** Date d'inscription à la lettre (ISO), si elle est inscrite. */
  inscriteLe?: string;
  /** Date de la dernière commande (ISO), si elle en a passé une. */
  derniereCommande?: string;
  /** Téléphone relevé sur sa commande la plus récente, s'il a été saisi. */
  telephone?: string;
}

export const STATUT_LABEL: Record<ContactStatut, string> = {
  cliente: "Cliente",
  inscrite: "Lettre",
  "cliente-inscrite": "Cliente + lettre",
};
