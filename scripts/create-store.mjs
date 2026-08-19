#!/usr/bin/env node
/**
 * Crée une nouvelle boutique à partir du modèle.
 *
 *   node scripts/create-store.mjs --prefix meridian --name "Meridian" \
 *     --dir "../meridian" [--order-prefix MRD-]
 *
 * Fait la partie MÉCANIQUE, celle qu'il ne faut pas retaper à la main :
 *   1. copie du modèle (sans node_modules, .next, .git, data, .env.local)
 *   2. écriture de config/store.config.ts avec le préfixe de la boutique
 *   3. nom du projet dans package.json
 *   4. création des 3 tables Supabase depuis supabase/schema.sql
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
 * Ce script écrit dans VOTRE projet Supabase et sous VOTRE identité git.
 * Les valeurs viennent donc de l'environnement, jamais du modèle : sans
 * cela, un utilisateur qui clone ce dépôt créerait ses tables dans la base
 * de quelqu'un d'autre.
 *
 * À définir une fois pour toutes dans votre shell (~/.zshrc) :
 *
 *   export BOUTIQUE_SUPABASE_PROJECT="<ref de votre projet>"
 *   export BOUTIQUE_GIT_NAME="<votre nom git>"
 *   export BOUTIQUE_GIT_EMAIL="<votre e-mail git>"
 *   export BOUTIQUE_UPSTREAM="<url du modèle>"   # optionnel
 *
 * ⚠️ Un projet Supabase peut être PARTAGÉ entre plusieurs boutiques. Toute
 * requête SQL doit alors être limitée aux tables du préfixe : ne JAMAIS
 * lancer de `drop`/`truncate` sans filtre de préfixe.
 */
const SUPABASE_PROJECT = process.env.BOUTIQUE_SUPABASE_PROJECT || "";
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

/* ─────────────────── 1. copie du modèle ─────────────────── */
console.log(`\n▸ Copie du modèle vers ${dir}`);
/*
  ⚠️ `fs.cpSync` et NON `rsync` : rsync n'existe pas sur Windows, et la
  première étape du script y échouait donc avant même de commencer.
  L'API Node fonctionne à l'identique sur les trois systèmes.
*/
const EXCLUS = new Set([
  "node_modules", ".next", ".git", "data", ".env.local", ".vercel",
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

/* ─────────────────── 4. tables Supabase ─────────────────── */
console.log("▸ Création des tables Supabase");
let token = "";
if (!SUPABASE_PROJECT) {
  console.warn(
    "  ⚠ BOUTIQUE_SUPABASE_PROJECT non défini — tables à créer à la main.\n" +
      "    La référence du projet se lit dans son URL Supabase :\n" +
      "    https://supabase.com/dashboard/project/<REF>",
  );
} else {
  try {
    // Jeton d'accès personnel Supabase. Le trousseau macOS est renseigné par
    // `supabase login` ; la variable d'environnement sert aux autres systèmes.
    token =
      process.env.SUPABASE_ACCESS_TOKEN ||
      execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], {
        encoding: "utf8",
        timeout: 15_000,
      }).trim();
  } catch {
    console.warn(
      "  ⚠ Jeton Supabase introuvable — lancez `supabase login`, ou définissez\n" +
        "    SUPABASE_ACCESS_TOKEN. Tables à créer à la main en attendant.",
    );
  }
}
if (token && SUPABASE_PROJECT) {
  const sql = fs
    .readFileSync(path.join(dir, "supabase/schema.sql"), "utf8")
    .replaceAll("{{prefix}}", prefix);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // ⚠️ Sans User-Agent, Cloudflare renvoie une erreur 1010.
        "User-Agent": "claude-code",
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) fail(`Supabase a refusé le schéma (${res.status}) : ${await res.text()}`);
  console.log(`  ✓ ${prefix}_kv, ${prefix}_visits, ${prefix}_visitors`);
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
const env = fs.readFileSync(path.join(dir, ".env.example"), "utf8").replace(
  /^AUTH_SECRET=$/m,
  `AUTH_SECRET=${randomBytes(32).toString("base64")}`,
);
fs.writeFileSync(path.join(dir, ".env.local"), env);
console.log("▸ .env.local créé (AUTH_SECRET généré, reste à compléter)");

console.log(`
✔ Boutique « ${name} » initialisée.

  Il reste à faire, dans l'ordre :
    1. compléter .env.local (Supabase, admin, Resend)
    2. npm install
    3. config/brand.config.ts — identité, palette, MENTIONS LÉGALES
    4. config/fonts.ts, components/site/Logo.tsx
    5. la vitrine + le catalogue + les photos
    6. npx tsc --noEmit && npm run build, vérification navigateur, déploiement

  ⚠️ Relire « Ce qu'une vitrine réécrite doit CONSERVER » (§1 du
     TEMPLATE-HANDOFF) avant de toucher à app/(storefront)/.
`);
