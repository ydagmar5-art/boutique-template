import "server-only";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { hasSupabase, supabaseAdmin } from "@/lib/supabase/server";
import { store } from "@/config/store.config";

/**
 * Stockage clé→valeur (JSON) durable.
 * - Si Supabase est configuré : table Postgres `<prefix>_kv` (durable, partagé). ✅
 * - Sinon (dev local sans env) : fichiers JSON (repli).
 *
 * Les actions (`lib/actions/*`) utilisent read/write sans se soucier du backend.
 */

const KV = store.db.kv;

export async function read<T>(name: string, seed: T): Promise<T> {
  if (hasSupabase()) {
    const sb = supabaseAdmin();
    const { data } = await sb.from(KV).select("value").eq("key", name).maybeSingle();
    if (data) return data.value as T;
    await sb.from(KV).upsert({ key: name, value: seed });
    return seed;
  }
  return fileRead(name, seed);
}

export async function write<T>(name: string, data: T): Promise<void> {
  if (hasSupabase()) {
    await supabaseAdmin()
      .from(KV)
      .upsert({ key: name, value: data, updated_at: new Date().toISOString() });
    return;
  }
  return fileWrite(name, data);
}

/**
 * Verrou ATOMIQUE à usage unique.
 *
 * `read` puis `write` ne suffisent pas à garantir l'unicité : la page de retour
 * du client et le webhook du PSP arrivent quasiment en même temps, lisent tous
 * les deux « pas encore traité » et créent tous les deux la commande. Ici on
 * s'appuie sur l'unicité de la clé primaire Postgres — la seconde insertion
 * échoue, c'est le seul point de synchronisation fiable entre deux requêtes
 * servies par des instances différentes.
 *
 * @returns true si le verrou a été obtenu, false s'il était déjà pris.
 */
export async function acquireLock(name: string): Promise<boolean> {
  const key = `lock_${name}`;
  if (hasSupabase()) {
    const { error } = await supabaseAdmin()
      .from(KV)
      .insert({ key, value: { at: new Date().toISOString() } });
    return !error; // erreur = clé déjà présente (violation d'unicité)
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
  if (hasSupabase()) {
    await supabaseAdmin().from(KV).delete().eq("key", key);
    return;
  }
  try {
    await fs.unlink(fileFor(key));
  } catch {
    /* ignore */
  }
}

/* ─────────── Repli fichier (dev local) ─────────── */

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), `${store.prefix}-data`)
  : path.join(process.cwd(), "data");

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
