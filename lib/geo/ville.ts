import "server-only";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  VILLE D'UN VISITEUR, DÉDUITE DE SON ADRESSE IP                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Hostinger transmet l'adresse IP mais aucune ville (contrairement à Vercel
 * ou Cloudflare). La recherche se fait donc ICI, dans un fichier local tiré
 * de DB-IP (voir `scripts/geo-villes.mjs`) : aucune adresse ne part chez un
 * tiers, aucun compte, aucune limite de requêtes.
 *
 * ⚠️ C'EST UNE APPROXIMATION. Sur mobile, l'opérateur sort souvent par une
 * grande ville (Madrid, Barcelone) : une visiteuse de Tolède peut apparaître
 * à Madrid. Assez juste pour lire une tendance, jamais pour une adresse.
 *
 * ⚠️ Chargée UNE FOIS, au premier appel, puis gardée en mémoire sous forme
 * de tableaux typés (une quinzaine de Mo). Fichier absent ou illisible : la
 * fonction renvoie `undefined` et le back-office affiche « — », comme avant.
 */

const FICHIER = path.join(process.cwd(), "lib", "geo", "ip-lieux.bin.gz");

type Base = {
  noms: string[];
  v4d: Uint32Array;
  v4f: Uint32Array;
  v4i: Uint32Array;
  /* IPv6 : 64 premiers bits, coupés en deux mots de 32 bits (haut, bas). */
  v6dh: Uint32Array;
  v6dl: Uint32Array;
  v6fh: Uint32Array;
  v6fl: Uint32Array;
  v6i: Uint32Array;
};

let base: Base | null | undefined;

/** Format écrit par `scripts/geo-villes.mjs` (voir son en-tête). */
function charger(): Base | null {
  if (base !== undefined) return base;
  try {
    const brut = zlib.gunzipSync(fs.readFileSync(FICHIER));
    const vue = new DataView(brut.buffer, brut.byteOffset, brut.byteLength);
    const tailleEntete = vue.getUint32(0, true);
    const entete = JSON.parse(brut.subarray(4, 4 + tailleEntete).toString("utf8")) as {
      noms: string[];
      n4: number;
      n6: number;
    };
    let pos = Math.ceil((4 + tailleEntete) / 4) * 4;
    /* Lecture explicite en petit-boutiste : ne dépend pas du processeur. */
    const colonne = (n: number) => {
      const t = new Uint32Array(n);
      for (let k = 0; k < n; k++, pos += 4) t[k] = vue.getUint32(pos, true);
      return t;
    };
    const { n4, n6 } = entete;
    base = {
      noms: entete.noms,
      v4d: colonne(n4),
      v4f: colonne(n4),
      v4i: colonne(n4),
      v6dh: colonne(n6),
      v6dl: colonne(n6),
      v6fh: colonne(n6),
      v6fl: colonne(n6),
      v6i: colonne(n6),
    };
  } catch {
    base = null;
  }
  return base;
}

function ipv4(ip: string): number | undefined {
  const o = ip.split(".");
  if (o.length !== 4) return undefined;
  let n = 0;
  for (const x of o) {
    const v = Number(x);
    if (!Number.isInteger(v) || v < 0 || v > 255) return undefined;
    n = n * 256 + v;
  }
  return n;
}

/** Les 64 premiers bits d'une IPv6, en deux mots de 32 bits. */
function ipv6(ip: string): [number, number] | undefined {
  const sansZone = ip.split("%")[0];
  const parts = sansZone.split("::");
  if (parts.length > 2) return undefined;
  const gauche = parts[0] ? parts[0].split(":") : [];
  const droite = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const manque = parts.length === 2 ? 8 - gauche.length - droite.length : 0;
  const mots = [...gauche, ...Array(Math.max(0, manque)).fill("0"), ...droite];
  if (mots.length < 4 || mots.slice(0, 4).some((m) => !/^[0-9a-f]{1,4}$/i.test(m))) return undefined;
  const m = mots.slice(0, 4).map((x) => parseInt(x, 16));
  return [m[0] * 0x10000 + m[1], m[2] * 0x10000 + m[3]];
}

/** Dernier indice dont le début est ≤ à la valeur cherchée, ou -1. */
function chercher(n: number, avant: (i: number) => boolean): number {
  let bas = 0;
  let haut = n - 1;
  let trouve = -1;
  while (bas <= haut) {
    const mil = (bas + haut) >>> 1;
    if (avant(mil)) {
      trouve = mil;
      bas = mil + 1;
    } else haut = mil - 1;
  }
  return trouve;
}

const nomsPays = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

/** « Madrid » pour une ville connue, « États-Unis » quand seul le pays l'est. */
function libelle(brut: string): string {
  if (brut.includes("|")) return brut.split("|")[0];
  return nomsPays?.of(brut) ?? brut;
}

/**
 * Ville (ou pays) d'une adresse IP, ou `undefined` si inconnue.
 * Accepte IPv4, IPv6 et la forme mixte `::ffff:1.2.3.4`.
 */
export function lieuDepuisIp(ip?: string | null): string | undefined {
  if (!ip) return undefined;
  const b = charger();
  if (!b) return undefined;
  const brute = ip.trim().replace(/^::ffff:/i, "");

  const n4 = ipv4(brute);
  if (n4 !== undefined) {
    const i = chercher(b.v4d.length, (k) => b.v4d[k] <= n4);
    return i >= 0 && n4 <= b.v4f[i] ? libelle(b.noms[b.v4i[i]]) : undefined;
  }

  const n6 = ipv6(brute);
  if (!n6) return undefined;
  const [h, l] = n6;
  const i = chercher(b.v6dh.length, (k) => b.v6dh[k] < h || (b.v6dh[k] === h && b.v6dl[k] <= l));
  if (i < 0) return undefined;
  const dansPlage = h < b.v6fh[i] || (h === b.v6fh[i] && l <= b.v6fl[i]);
  return dansPlage ? libelle(b.noms[b.v6i[i]]) : undefined;
}
