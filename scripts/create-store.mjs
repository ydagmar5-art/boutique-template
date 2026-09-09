#!/usr/bin/env node
/**
 * Crée une nouvelle boutique à partir du modèle.
 *
 *   node scripts/create-store.mjs --prefix meridian --name "Meridian" \
 *     --dir "../meridian" --domain meridian.fr [--order-prefix MRD-]
 *
 * Fait la partie MÉCANIQUE, celle qu'il ne faut pas retaper à la main :
 *   1. copie du modèle (sans node_modules, .next, .git, data, media, .env.local)
 *   2. écriture de config/store.config.ts avec le préfixe de la boutique
 *   3. nom du projet dans package.json
 *   4. base MySQL Hostinger : création (CLI) puis exécution de db/schema.sql
 *      ⚠️ exige --domain : chez Hostinger une base est RATTACHÉE à un site,
 *      et le site doit donc exister AVANT (hosting websites create)
 *   5. dépôt git initialisé, modèle ajouté en amont (`upstream`) pour
 *      pouvoir récupérer les correctifs du noyau plus tard
 *   6. .env.local avec un AUTH_SECRET fraîchement généré
 *
 * NE FAIT PAS (et ne doit pas) : la vitrine, le catalogue, le déploiement.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TEMPLATE_DIR = path.resolve(import.meta.dirname, "..");
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  RESSOURCES DE L'UTILISATEUR — rien n'est codé en dur ici        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Ce script écrit dans VOTRE hébergement Hostinger et sous VOTRE identité
 * git. Les valeurs viennent donc de l'environnement, jamais du modèle : sans
 * cela, un utilisateur qui clone ce dépôt créerait ses tables dans la base de
 * quelqu'un d'autre.
 *
 * À définir une fois pour toutes dans votre shell (~/.zshrc) :
 *
 *   export BOUTIQUE_HOSTINGER_ACCOUNT="u123456789"   # hosting websites list
 *   export BOUTIQUE_MYSQL_HOST="srv1234.hstgr.io"    # hôte MySQL distant
 *   export BOUTIQUE_GIT_NAME="<votre nom git>"
 *   export BOUTIQUE_GIT_EMAIL="<votre e-mail git>"
 *   export BOUTIQUE_UPSTREAM="<url du modèle>"       # optionnel
 *
 * ⚠️ Une base MySQL peut être PARTAGÉE entre plusieurs boutiques. Toute
 * requête doit alors être limitée aux tables du préfixe : ne JAMAIS lancer de
 * `drop`/`truncate` sans filtre de préfixe.
 */
const ACCOUNT = process.env.BOUTIQUE_HOSTINGER_ACCOUNT || "";
const MYSQL_HOST = process.env.BOUTIQUE_MYSQL_HOST || "";
const UPSTREAM =
  process.env.BOUTIQUE_UPSTREAM ||
  "https://github.com/ydagmar5-art/boutique-template.git";
const GIT_NAME = process.env.BOUTIQUE_GIT_NAME || "";
const GIT_EMAIL = process.env.BOUTIQUE_GIT_EMAIL || "";

/* ─────────────────────────── arguments ─────────────────────────── */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const prefix = (args.prefix || "").trim();
const name = (args.name || "").trim();
const dir = (args.dir || "").trim();
if (!prefix || !name || !dir) fail("--prefix, --name et --dir sont obligatoires.");
if (!/^[a-z][a-z0-9]{2,15}$/.test(prefix))
  fail(`Préfixe invalide : « ${prefix} ». Attendu : 3 à 16 caractères, minuscules et chiffres, commençant par une lettre.`);
if (fs.existsSync(dir)) fail(`Le dossier existe déjà : ${dir}`);

const orderPrefix = (args["order-prefix"] || prefix.slice(0, 3).toUpperCase() + "-").trim();
const domain = (typeof args.domain === "string" && args.domain.trim()) || "";

/* ─────────────────── 1. copie du modèle ─────────────────── */
console.log(`\n▸ Copie du modèle vers ${dir}`);
/*
  ⚠️ `fs.cpSync` et NON `rsync` : rsync n'existe pas sur Windows, et la
  première étape du script y échouait donc avant même de commencer.
  L'API Node fonctionne à l'identique sur les trois systèmes.
*/
const EXCLUS = new Set([
  "node_modules", ".next", ".git", "data", "media", ".env.local",
  "tsconfig.tsbuildinfo",
]);
fs.cpSync(TEMPLATE_DIR, dir, {
  recursive: true,
  // `filter` reçoit le chemin ABSOLU : on ne compare que le nom, sinon un
  // dossier « data » imbriqué serait épargné et le vrai copié.
  filter: (src) => !EXCLUS.has(path.basename(src)),
});

/* ─────────────────── 2. store.config.ts ─────────────────── */
const cfgPath = path.join(dir, "config/store.config.ts");
let cfg = fs.readFileSync(cfgPath, "utf8");
cfg = cfg.replace(/^const PREFIX = "demo";$/m, `const PREFIX = "${prefix}";`);
cfg = cfg.replace(/prefix: "CMD-"/, `prefix: "${orderPrefix}"`);
if (!cfg.includes(`const PREFIX = "${prefix}"`))
  fail("Le préfixe n'a pas pu être écrit dans store.config.ts (fichier modifié ?).");
fs.writeFileSync(cfgPath, cfg);
console.log(`▸ Préfixe « ${prefix} » · commandes « ${orderPrefix}1001 »`);

/* ─────────────────── 3. package.json ─────────────────── */
const pkgPath = path.join(dir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.name = prefix;
pkg.description = `Boutique ${name}`;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

/* ─────────────────── 4. base MySQL Hostinger ─────────────────── */
console.log("▸ Base de données");

/* Le schéma, préfixe résolu. Écrit sur disque quoi qu'il arrive : c'est ce
   fichier qu'on colle dans phpMyAdmin si la connexion distante n'est pas
   ouverte, et il documente ce qui a réellement été joué. */
const sql = fs
  .readFileSync(path.join(dir, "db/schema.sql"), "utf8")
  .replaceAll("{{prefix}}", prefix);
const sqlPath = path.join(dir, "db/install.sql");
fs.writeFileSync(sqlPath, sql);

const hostinger = (...a) =>
  execFileSync("hostinger", [...a, "--format", "json"], {
    encoding: "utf8",
    timeout: 60_000,
  });

/** Mot de passe acceptable par MySQL ET sans caractère qui casse une URL. */
const motDePasse = () => randomBytes(18).toString("base64url") + "aA1";

let db = { name: "", user: "", password: "", host: MYSQL_HOST || "localhost" };

if (!ACCOUNT || !domain) {
  /* ⚠️ Une base Hostinger est RATTACHÉE À UN SITE : `databases create` exige
     `--website-domain`, et le site doit donc exister avant. Sans le domaine,
     on ne devine pas — on laisse le SQL sur disque et on le dit. */
  console.warn(
    !ACCOUNT
      ? "  ⚠ BOUTIQUE_HOSTINGER_ACCOUNT non défini — base à créer à la main.\n" +
          "    L'identifiant du compte se lit dans :  hostinger hosting websites list"
      : "  ⚠ --domain absent — base non créée.\n" +
          "    Une base Hostinger est rattachée à un site : créez-le d'abord avec\n" +
          "    hostinger hosting websites create --domain <domaine> --order-id <id>",
  );
} else {
  db.name = `${prefix}_shop`;
  db.user = `${prefix}_app`;
  db.password = motDePasse();
  try {
    hostinger(
      "hosting", "databases", "create", ACCOUNT,
      "--name", db.name, "--user", db.user, "--password", db.password,
      "--website-domain", domain,
    );
    console.log(`  ✓ base « ${db.name} », utilisateur « ${db.user} »`);
    console.log("    ⚠️ Le compte est PRÉFIXÉ par Hostinger : le nom réel est");
    console.log("       visible dans  hostinger hosting databases list " + ACCOUNT);
  } catch (e) {
    console.warn(`  ⚠ Création refusée : ${String(e.stderr || e.message).trim()}`);
    db = { name: "", user: "", password: "", host: db.host };
  }
}

/* Exécution du schéma. Elle n'est possible que depuis une machine autorisée :
   `hostinger hosting databases create-remote-connection <compte> <base> --ip <IP>`.
   Sans hôte distant connu, on ne devine pas — on donne le chemin manuel. */
let schemaJoue = false;
if (db.name && MYSQL_HOST) {
  try {
    const { default: mysql } = await import("mysql2/promise");
    const cnx = await mysql.createConnection({
      host: MYSQL_HOST,
      user: db.user,
      password: db.password,
      database: db.name,
      multipleStatements: true, // le schéma est un lot, pas une requête
      connectTimeout: 15_000,
    });
    await cnx.query(sql);
    await cnx.end();
    schemaJoue = true;
    console.log(`  ✓ tables ${prefix}_kv, _visits, _visitors, _presence`);
  } catch (e) {
    console.warn(`  ⚠ Schéma non joué : ${e.message}`);
    console.warn(
      "    Autorisez d'abord votre machine :\n" +
        `    hostinger hosting databases create-remote-connection ${ACCOUNT} ${db.name} --ip <votre IP>`,
    );
  }
}
if (!schemaJoue) {
  console.warn(`  → SQL prêt à coller : ${path.relative(process.cwd(), sqlPath)}`);
  if (ACCOUNT) {
    try {
      const lien = JSON.parse(hostinger("hosting", "databases", "phpmyadmin-link", ACCOUNT, db.name || prefix));
      if (lien?.url) console.warn(`  → phpMyAdmin : ${lien.url}`);
    } catch {
      /* lien indisponible : le SQL sur disque suffit */
    }
  }
}

/* ─────────────────── 5. dépôt git ─────────────────── */
const git = (...a) =>
  execFileSync("git", ["-C", dir, ...a], { stdio: "pipe", timeout: 30_000 });
git("init", "-q");
/* Identité git de la boutique. Renseignée seulement si l'utilisateur l'a
   définie : sinon on laisse la configuration globale de sa machine, plutôt
   que d'attribuer ses commits à quelqu'un d'autre. */
if (GIT_NAME) git("config", "user.name", GIT_NAME);
if (GIT_EMAIL) git("config", "user.email", GIT_EMAIL);
// `upstream` = le modèle. C'est lui qui permettra plus tard de récupérer
// un correctif du noyau : git fetch upstream && git merge upstream/main
git("remote", "add", "upstream", UPSTREAM);
console.log("▸ Dépôt git initialisé, modèle ajouté en amont (upstream)");

/* ─────────────────── 6. .env.local ─────────────────── */
let env = fs.readFileSync(path.join(dir, ".env.example"), "utf8").replace(
  /^AUTH_SECRET=$/m,
  `AUTH_SECRET=${randomBytes(32).toString("base64")}`,
);
if (db.name) {
  env = env
    .replace(/^MYSQL_HOST=.*$/m, `MYSQL_HOST=${db.host}`)
    .replace(/^MYSQL_USER=$/m, `MYSQL_USER=${db.user}`)
    .replace(/^MYSQL_PASSWORD=$/m, `MYSQL_PASSWORD=${db.password}`)
    .replace(/^MYSQL_DATABASE=$/m, `MYSQL_DATABASE=${db.name}`);
}
fs.writeFileSync(path.join(dir, ".env.local"), env);
console.log("▸ .env.local créé (AUTH_SECRET généré, reste à compléter)");

console.log(`
✔ Boutique « ${name} » initialisée.

  Il reste à faire, dans l'ordre :
    1. compléter .env.local (base, admin, SMTP)
    2. npm install
    3. config/brand.config.ts — identité, palette, MENTIONS LÉGALES
    4. config/fonts.ts, components/site/Logo.tsx
    5. la vitrine + le catalogue + les photos
    6. npx tsc --noEmit && npm run build, vérification navigateur, déploiement

  ⚠️ Relire « Ce qu'une vitrine réécrite doit CONSERVER » (§1 du
     TEMPLATE-HANDOFF) avant de toucher à app/(storefront)/.
`);
