import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { hasDb, q, exec, pool, estDoublon, sqlDate } from "@/lib/db/mysql";
import { store } from "@/config/store.config";

/**
 * Stockage clé→valeur (JSON) durable.
 * - Si la base est configurée : table MySQL `<prefix>_kv` (durable, partagée). ✅
 * - Sinon (dev local sans env) : fichiers JSON (repli).
 *
 * Les actions (`lib/actions/*`) utilisent read/write sans se soucier du backend.
 */

const KV = store.db.kv;

export async function read<T>(name: string, seed: T): Promise<T> {
  if (hasDb()) {
    const rows = await q<{ value: string }>(
      `select \`value\` from \`${KV}\` where \`key\` = ? limit 1`,
      [name],
    );
    if (rows.length) return JSON.parse(rows[0].value) as T;
    /* `insert ignore` et non `insert` : deux requêtes servies en parallèle
       peuvent semer la même clé en même temps, et la seconde ne doit pas
       remonter une erreur pour une valeur qui est de toute façon la bonne. */
    await exec(
      `insert ignore into \`${KV}\` (\`key\`, \`value\`) values (?, ?)`,
      [name, JSON.stringify(seed)],
    );
    return seed;
  }
  return fileRead(name, seed);
}

export async function write<T>(name: string, data: T): Promise<void> {
  if (hasDb()) {
    const json = JSON.stringify(data);
    /* ⚠️ `values(...)` dans la clause de mise à jour est DÉPRÉCIÉ par MySQL 8
       et absent de certaines versions de MariaDB. On repasse le paramètre
       plutôt que de dépendre d'une syntaxe qui diffère selon le moteur. */
    await exec(
      `insert into \`${KV}\` (\`key\`, \`value\`, \`updated_at\`) values (?, ?, ?)
       on duplicate key update \`value\` = ?, \`updated_at\` = ?`,
      [name, json, sqlDate(), json, sqlDate()],
    );
    return;
  }
  return fileWrite(name, data);
}

/**
 * Toutes les clés commençant par `prefix` (brouillons de paiement en attente,
 * par exemple `pending_whop_`), avec leur date de mise à jour.
 *
 * ⚠️ `_` et `%` sont des jokers de LIKE : on les échappe, sinon
 * `pending_whop_` attraperait aussi `pendingXwhopY…`.
 */
export async function listByPrefix<T>(
  prefix: string,
): Promise<{ key: string; value: T; updatedAt?: string }[]> {
  if (hasDb()) {
    const motif = prefix.replace(/[\\%_]/g, (c) => `\\${c}`) + "%";
    const rows = await q<{ key: string; value: string; updated_at: Date | string | null }>(
      `select \`key\`, \`value\`, \`updated_at\` from \`${KV}\` where \`key\` like ?`,
      [motif],
    );
    return rows.map((r) => ({
      key: r.key,
      value: JSON.parse(r.value) as T,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
  }
  await ensureDir();
  const noms = (await fs.readdir(DATA_DIR).catch(() => [] as string[])).filter(
    (n) => n.startsWith(prefix) && n.endsWith(".json"),
  );
  const out: { key: string; value: T }[] = [];
  for (const n of noms) {
    try {
      out.push({ key: n.slice(0, -5), value: JSON.parse(await fs.readFile(path.join(DATA_DIR, n), "utf8")) as T });
    } catch {
      /* fichier illisible : ignoré */
    }
  }
  return out;
}

/**
 * Verrou ATOMIQUE à usage unique.
 *
 * `read` puis `write` ne suffisent pas à garantir l'unicité : la page de retour
 * du client et le webhook du PSP arrivent quasiment en même temps, lisent tous
 * les deux « pas encore traité » et créent tous les deux la commande. Ici on
 * s'appuie sur l'unicité de la clé primaire MySQL — la seconde insertion
 * échoue avec `ER_DUP_ENTRY`, c'est le seul point de synchronisation fiable
 * entre deux requêtes servies par des processus différents.
 *
 * @returns true si le verrou a été obtenu, false s'il était déjà pris.
 */
export async function acquireLock(name: string): Promise<boolean> {
  const key = `lock_${name}`;
  if (hasDb()) {
    try {
      await exec(
        `insert into \`${KV}\` (\`key\`, \`value\`) values (?, ?)`,
        [key, JSON.stringify({ at: new Date().toISOString() })],
      );
      return true;
    } catch (e) {
      /* ⚠️ Ne renvoyer `false` que sur un DOUBLON. Une base injoignable
         produirait sinon un « verrou déjà pris » permanent : plus aucune
         commande ne serait enregistrée, en silence. */
      if (estDoublon(e)) return false;
      throw e;
    }
  }
  await ensureDir();
  try {
    // "wx" échoue si le fichier existe déjà — atomique côté système.
    await fs.writeFile(fileFor(key), "{}", { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

/** Libère un verrou — à n'appeler que si le traitement a ÉCHOUÉ, pour laisser une nouvelle tentative possible. */
export async function releaseLock(name: string): Promise<void> {
  const key = `lock_${name}`;
  if (hasDb()) {
    await exec(`delete from \`${KV}\` where \`key\` = ?`, [key]);
    return;
  }
  try {
    await fs.unlink(fileFor(key));
  } catch {
    /* ignore */
  }
}

/** Ferme le pool — utilisé par les scripts, jamais par l'application. */
export async function closeDb(): Promise<void> {
  if (hasDb()) await pool().end();
}

/* ─────────── Repli fichier (dev local) ─────────── */

/**
 * ⚠️ Repli de DÉVELOPPEMENT uniquement. Chez Hostinger le disque est bien
 * inscriptible, mais un déploiement REMPLACE le contenu du site : des
 * commandes écrites ici disparaîtraient à la mise en ligne suivante. En
 * production, la base est obligatoire.
 */
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}
const fileFor = (name: string) => path.join(DATA_DIR, `${name}.json`);

async function fileRead<T>(name: string, seed: T): Promise<T> {
  await ensureDir();
  try {
    return JSON.parse(await fs.readFile(fileFor(name), "utf8")) as T;
  } catch {
    try {
      await fs.writeFile(fileFor(name), JSON.stringify(seed, null, 2));
    } catch {
      /* ignore */
    }
    return seed;
  }
}

async function fileWrite<T>(name: string, data: T): Promise<void> {
  await ensureDir();
  try {
    await fs.writeFile(fileFor(name), JSON.stringify(data, null, 2));
  } catch {
    /* ignore */
  }
}
