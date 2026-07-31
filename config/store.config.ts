/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  IDENTIFIANTS TECHNIQUES DE LA BOUTIQUE                          ║
 * ║                                                                  ║
 * ║  Une seule ligne à changer pour lancer une nouvelle boutique :   ║
 * ║  `PREFIX` ci-dessous. Tout le reste s'en déduit.                 ║
 * ║                                                                  ║
 * ║  ⚠️ CE FICHIER N'EST PAS COSMÉTIQUE. Le préfixe isole les        ║
 * ║  données d'une boutique de celles des autres dans le MÊME projet ║
 * ║  Supabase. Deux boutiques qui partagent un préfixe partagent     ║
 * ║  leur catalogue, leurs commandes et leurs clients.               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

/**
 * Préfixe unique de la boutique — minuscules, sans espace ni tiret.
 * Sert de nom de schéma logique : `<prefix>_kv`, `<prefix>_visits`…
 */
const PREFIX = "demo";

export const store = {
  prefix: PREFIX,

  /**
   * Tables Postgres (Supabase). À créer AVANT le premier lancement —
   * voir la checklist du TEMPLATE-HANDOFF, elles ne se créent pas seules.
   */
  db: {
    kv: `${PREFIX}_kv`,
    visits: `${PREFIX}_visits`,
    visitors: `${PREFIX}_visitors`,
  },

  /**
   * Cookies. Des noms distincts par boutique évitent qu'un visiteur passé
   * d'une boutique à l'autre (même navigateur) hérite d'une session admin
   * ou d'un identifiant de visiteur qui fausserait les statistiques.
   */
  cookies: {
    visitor: `${PREFIX}_vid`,
    session: `${PREFIX}_session`,
  },

  /** Clés de stockage navigateur (localStorage). */
  storage: {
    cart: `${PREFIX}-cart`,
  },

  /** Canal Supabase Realtime pour la présence des visiteurs en direct. */
  realtimeChannel: `${PREFIX}-live`,

  /**
   * Numérotation des commandes.
   * ⚠️ `firstOrderNumber` n'est qu'un point de départ : la numérotation
   * réelle se calcule sur le PLUS GRAND numéro déjà attribué (jamais sur le
   * nombre de commandes, qui rejoue un numéro après chaque suppression).
   */
  orders: {
    prefix: "CMD-",
    firstOrderNumber: 1000,
  },
} as const;
