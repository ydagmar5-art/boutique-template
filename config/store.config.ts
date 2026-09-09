/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  IDENTIFIANTS TECHNIQUES DE LA BOUTIQUE                          ║
 * ║                                                                  ║
 * ║  Une seule ligne à changer pour lancer une nouvelle boutique :   ║
 * ║  `PREFIX` ci-dessous. Tout le reste s'en déduit.                 ║
 * ║                                                                  ║
 * ║  ⚠️ CE FICHIER N'EST PAS COSMÉTIQUE. Le préfixe isole les        ║
 * ║  données d'une boutique de celles des autres dans la MÊME base   ║
 * ║  MySQL. Deux boutiques qui partagent un préfixe partagent leur   ║
 * ║  catalogue, leurs commandes et leurs clients.                    ║
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
   * Tables MySQL (hébergement Hostinger). À créer AVANT le premier
   * lancement — `db/schema.sql`, joué par `scripts/create-store.mjs`.
   * Elles ne se créent pas seules au démarrage de l'application.
   */
  db: {
    kv: `${PREFIX}_kv`,
    visits: `${PREFIX}_visits`,
    visitors: `${PREFIX}_visitors`,
    presence: `${PREFIX}_presence`,
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

  /**
   * Présence « en direct » du back-office, en secondes.
   *
   * ⚠️ Les deux valeurs sont liées : `battement` est la cadence à laquelle
   * le navigateur signale qu'il est toujours là, `perime` le délai au-delà
   * duquel on considère la visiteuse partie. `perime` doit valoir au moins
   * trois battements — sinon un simple retard réseau la fait disparaître,
   * puis réapparaître, et le carillon sonne à chaque aller-retour.
   */
  presence: {
    battement: 15,
    perime: 50,
  },

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
