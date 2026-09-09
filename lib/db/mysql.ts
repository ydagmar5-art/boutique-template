import "server-only";
import mysql from "mysql2/promise";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  BASE DE DONNÉES — MySQL/MariaDB de l'hébergement Hostinger      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Une seule base par compte d'hébergement, partagée entre les boutiques :
 * c'est le PRÉFIXE des tables (`config/store.config.ts`) qui les isole,
 * exactement comme avant. Aucune requête sans filtre de préfixe.
 *
 * Deux façons de la configurer, au choix :
 *   · DATABASE_URL=mysql://user:motdepasse@hôte:3306/base
 *   · MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE
 *
 * Sans configuration, `hasDb()` est faux et l'application retombe sur le
 * stockage fichier (`./data`) — utilisable en développement seulement.
 */

function config(): mysql.PoolOptions | null {
  const url = process.env.DATABASE_URL;
  const base: mysql.PoolOptions = {
    /**
     * ⚠️ PLAFOND DE CONNEXIONS. Un hébergement mutualisé Hostinger n'accorde
     * que quelques dizaines de connexions simultanées à un compte, TOUTES
     * boutiques confondues. Un pool généreux (la valeur par défaut de mysql2
     * est 10 par instance) épuise le quota dès qu'un second processus démarre,
     * et l'erreur qui sort alors — `ER_CON_COUNT_ERROR` — ressemble à une
     * panne de la base, pas à un réglage.
     */
    connectionLimit: 4,
    waitForConnections: true,
    queueLimit: 0,
    /** L'hébergement coupe les connexions inactives : sans ça, la première
     *  requête après un creux de trafic échoue une fois sur deux. */
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    charset: "utf8mb4",
    /** Tout est stocké et relu en UTC : les DATETIME de MySQL ne portent
     *  aucun fuseau, et laisser mysql2 interpréter dans celui du serveur
     *  décalerait les statistiques d'une à deux heures selon la saison. */
    timezone: "Z",
    dateStrings: false,
  };

  if (url) return { ...base, uri: url };

  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;
  if (!host || !user || !database) return null;

  return {
    ...base,
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user,
    password,
    database,
  };
}

const CONFIG = config();

/** true si la base est configurée (sinon : repli fichier, dev uniquement). */
export function hasDb(): boolean {
  return CONFIG !== null;
}

let poolInstance: mysql.Pool | null = null;

/** Pool partagé. Créé à la première requête, jamais avant. */
export function pool(): mysql.Pool {
  if (!CONFIG) throw new Error("Base de données non configurée (DATABASE_URL ou MYSQL_*).");
  if (!poolInstance) {
    poolInstance = mysql.createPool(CONFIG);
    /**
     * ⚠️ FUSEAU DE LA SESSION, et pas seulement celui du pilote. L'option
     * `timezone` ci-dessus ne règle que la conversion faite par mysql2 ; les
     * valeurs par défaut du schéma (`current_timestamp(3)`) sont calculées
     * PAR LE SERVEUR, dans SON fuseau. Sans cette ligne, une même table
     * mélange des instants UTC écrits par l'application et des instants
     * locaux posés par la base — décalage d'une à deux heures selon la
     * saison, sur les statistiques comme sur la présence en direct.
     *
     * Un décalage numérique et non un nom de région : les tables de fuseaux
     * ne sont pas chargées sur tous les serveurs mutualisés, et `Europe/Paris`
     * y échoue silencieusement.
     */
    poolInstance.on("connection", (cnx) => {
      cnx.query("set time_zone = '+00:00'");
    });
  }
  return poolInstance;
}

/** Valeur acceptée comme paramètre lié — jamais un objet libre. */
export type Param = string | number | boolean | Date | null;

/** Requête de lecture. Renvoie les lignes typées. */
export async function q<T = Record<string, unknown>>(
  sql: string,
  params: Param[] = [],
): Promise<T[]> {
  const [rows] = await pool().query(sql, params);
  return rows as T[];
}

/** Requête d'écriture. Renvoie le nombre de lignes touchées. */
export async function exec(sql: string, params: Param[] = []): Promise<number> {
  const [res] = await pool().execute(sql, params);
  return (res as mysql.ResultSetHeader).affectedRows ?? 0;
}

/**
 * Instant SQL (`DATETIME(3)` en UTC) à partir d'une date JavaScript.
 *
 * ⚠️ `toISOString()` seul ne convient pas : MySQL refuse le `T` et le `Z`.
 */
export function sqlDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 23).replace("T", " ");
}

/** Vrai si l'erreur est une violation de clé primaire ou d'unicité. */
export function estDoublon(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "ER_DUP_ENTRY";
}
