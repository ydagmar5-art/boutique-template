#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  BASE « ADRESSE IP → VILLE » DU BACK-OFFICE                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Hostinger ne géolocalise rien : il transmet l'adresse IP, jamais la ville.
 * Sans cette base, la colonne « Ville » des statistiques reste vide.
 *
 * Source : DB-IP « IP to City Lite », gratuite, licence CC BY 4.0
 * (attribution obligatoire, affichée sous la liste des visiteurs).
 * Téléchargement, sans compte, le 1er de chaque mois :
 *   https://download.db-ip.com/free/dbip-city-lite-AAAA-MM.csv.gz
 *
 * Usage :
 *   node scripts/geo-villes.mjs <dbip-city-lite-AAAA-MM.csv.gz> [--pays ES,FR]
 *
 * ⚠️ VILLE SEULEMENT POUR LES PAYS DE LA BOUTIQUE (`--pays` ; par défaut, le
 * pays de `locale` dans `config/brand.config.ts`).
 * Le fichier complet compte près de 8 millions de plages ; les garder toutes
 * ferait un fichier de plusieurs centaines de Mo. Ailleurs, on ne garde que
 * le PAYS, en fusionnant les plages voisines du même pays : c'est ce qui
 * permet de reconnaître d'un coup d'œil un robot américain ou un visiteur
 * français.
 *
 * ⚠️ IPv6 : seuls les 64 premiers bits sont conservés. Un opérateur attribue
 * au minimum un /64 à un abonné, donc rien d'utile n'est perdu, et la
 * comparaison se fait sur des chaînes hexadécimales de même longueur.
 *
 * Sortie : `lib/geo/ip-lieux.bin.gz`, lu par `lib/geo/ville.ts`.
 *
 * ⚠️ FORMAT BINAIRE, PAS JSON. Relire 800 000 plages en JSON faisait monter
 * la mémoire du serveur de près de 200 Mo le temps de l'analyse. En binaire,
 * le chargement coûte la taille des tableaux (une quinzaine de Mo), rien de
 * plus. Disposition, entiers 32 bits petit-boutistes :
 *   [taille de l'en-tête][en-tête JSON : source, pays, noms, n4, n6]
 *   [bourrage jusqu'à un multiple de 4]
 *   v4 début · v4 fin · v4 lieu · v6 début haut · v6 début bas ·
 *   v6 fin haut · v6 fin bas · v6 lieu
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = path.join(RACINE, "lib", "geo", "ip-lieux.bin.gz");

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
const iPays = args.indexOf("--pays");
/* Par défaut : le pays de la langue de la boutique (`locale: "es-ES"` → ES). */
function paysDeLaBoutique() {
  try {
    const conf = fs.readFileSync(path.join(RACINE, "config", "brand.config.ts"), "utf8");
    return conf.match(/locale:\s*"[a-z]{2}-([A-Z]{2})"/)?.[1] ?? "ES";
  } catch {
    return "ES";
  }
}
const PAYS = new Set(
  (iPays >= 0 ? args[iPays + 1] : paysDeLaBoutique()).split(",").map((p) => p.trim().toUpperCase()),
);
if (!source || !fs.existsSync(source)) {
  console.error("Usage : node scripts/geo-villes.mjs <dbip-city-lite-AAAA-MM.csv.gz> [--pays ES,FR]");
  process.exit(1);
}

/** Découpe une ligne CSV, guillemets compris (« "Santa Cruz, La" »). */
function champs(ligne) {
  const out = [];
  let cur = "";
  let dedans = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (dedans) {
      if (c === '"' && ligne[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') dedans = false;
      else cur += c;
    } else if (c === '"') dedans = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const v4 = (ip) => ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);

/** Les 64 premiers bits d'une IPv6, en 16 caractères hexadécimaux. */
function v6(ip) {
  let [g, d] = ip.split("::");
  const gauche = g ? g.split(":") : [];
  const droite = d !== undefined && d !== "" ? d.split(":") : [];
  const manque = d === undefined ? 0 : 8 - gauche.length - droite.length;
  const mots = [...gauche, ...Array(manque).fill("0"), ...droite];
  return mots.slice(0, 4).map((m) => m.padStart(4, "0")).join("").toLowerCase();
}

const noms = [];
const indexNom = new Map();
const idx = (nom) => {
  let i = indexNom.get(nom);
  if (i === undefined) { i = noms.length; noms.push(nom); indexNom.set(nom, i); }
  return i;
};

const t4 = { d: [], f: [], i: [] };
const t6 = { d: [], f: [], i: [] };

/* Fusionne avec la plage précédente quand elle est contiguë et du même lieu. */
function ajouter(t, debut, fin, i, contigu) {
  const n = t.i.length - 1;
  if (n >= 0 && t.i[n] === i && contigu(t.f[n], debut)) { t.f[n] = fin; return; }
  t.d.push(debut); t.f.push(fin); t.i.push(i);
}
const contigu4 = (fin, debut) => debut === fin + 1;
const contigu6 = (fin, debut) => debut <= fin || BigInt("0x" + debut) === BigInt("0x" + fin) + 1n;

const lecteur = readline.createInterface({
  input: fs.createReadStream(source).pipe(zlib.createGunzip()),
  crlfDelay: Infinity,
});

let lignes = 0;
for await (const ligne of lecteur) {
  lignes++;
  const [debut, fin, , pays, region, ville] = champs(ligne);
  if (!pays || pays === "ZZ") continue;
  /* Ville pour les pays de la boutique ; pays seul ailleurs. Le code pays
     (deux lettres) sert d'étiquette : `ville.ts` le traduit en nom. */
  const lieu = PAYS.has(pays) && ville ? `${ville}|${region}|${pays}` : pays;
  const i = idx(lieu);
  if (debut.includes(":")) ajouter(t6, v6(debut), v6(fin), i, contigu6);
  else ajouter(t4, v4(debut), v4(fin), i, contigu4);
}

const entete = Buffer.from(
  JSON.stringify({
    source: `${path.basename(source)} — DB-IP IP to City Lite, CC BY 4.0`,
    pays: [...PAYS],
    noms,
    n4: t4.i.length,
    n6: t6.i.length,
  }),
  "utf8",
);
const debutTableaux = Math.ceil((4 + entete.length) / 4) * 4;
const colonnes = [
  t4.d, t4.f, t4.i,
  t6.d.map((h) => parseInt(h.slice(0, 8), 16)),
  t6.d.map((h) => parseInt(h.slice(8, 16), 16)),
  t6.f.map((h) => parseInt(h.slice(0, 8), 16)),
  t6.f.map((h) => parseInt(h.slice(8, 16), 16)),
  t6.i,
];
const tampon = Buffer.alloc(debutTableaux + colonnes.reduce((n, c) => n + c.length * 4, 0));
tampon.writeUInt32LE(entete.length, 0);
entete.copy(tampon, 4);
let pos = debutTableaux;
for (const col of colonnes) for (const v of col) { tampon.writeUInt32LE(v, pos); pos += 4; }

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, zlib.gzipSync(tampon, { level: 9 }));

console.log(`${lignes} lignes lues`);
console.log(`IPv4 : ${t4.i.length} plages · IPv6 : ${t6.i.length} plages · ${noms.length} lieux`);
console.log(`→ ${path.relative(RACINE, SORTIE)} (${(fs.statSync(SORTIE).size / 1e6).toFixed(1)} Mo)`);
