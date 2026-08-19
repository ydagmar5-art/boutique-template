#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  INSTALLATION DES COMPÉTENCES DE DESIGN                          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Copie les compétences fournies avec ce modèle vers `~/.claude/skills/`,
 * pour qu'une nouvelle boutique bénéficie des mêmes outils sans installation
 * manuelle.
 *
 *   node scripts/install-skills.mjs            # installe ce qui manque
 *   node scripts/install-skills.mjs --force    # réinstalle tout
 *   node scripts/install-skills.mjs --list     # état, sans rien écrire
 *
 * ⚠️ N'ÉCRASE JAMAIS une compétence déjà présente sans `--force` : l'auteur
 * a pu la modifier, et l'écraser en silence lui ferait perdre son travail.
 *
 * ⚠️ Portable : `fs.cpSync` et `os.homedir()`, aucune commande shell. Testé
 * sur macOS ; les mêmes API valent sur Windows et Linux, où `rsync`, `cp -R`
 * et `~` n'existent pas ou ne s'interprètent pas.
 *
 * ⚠️ Ces compétences ne sont pas l'œuvre de ce dépôt — voir skills/ATTRIBUTION.md.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SOURCE = path.join(import.meta.dirname, "..", "skills");
const CIBLE = path.join(os.homedir(), ".claude", "skills");

/** Compétences absentes de ce dépôt, faute de licence permettant de les redistribuer. */
const NON_REDISTRIBUABLES = ["ui-ux-pro-max", "brand"];

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const listeSeule = args.has("--list");

if (!fs.existsSync(SOURCE)) {
  console.error("✖ Dossier skills/ introuvable. Lancer depuis la racine du modèle.");
  process.exit(1);
}

const dispo = fs
  .readdirSync(SOURCE, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

fs.mkdirSync(CIBLE, { recursive: true });

let installees = 0;
let conservees = 0;

console.log(`\n▸ Compétences de design → ${CIBLE}\n`);

for (const nom of dispo) {
  const destination = path.join(CIBLE, nom);
  const existe = fs.existsSync(destination);

  if (listeSeule) {
    console.log(`  ${existe ? "déjà là " : "à poser "} ${nom}`);
    continue;
  }
  if (existe && !force) {
    console.log(`  = ${nom} — déjà présente, laissée intacte`);
    conservees++;
    continue;
  }
  fs.cpSync(path.join(SOURCE, nom), destination, { recursive: true, force: true });
  console.log(`  ✓ ${nom}`);
  installees++;
}

/* Les compétences qu'on ne peut pas fournir : le dire, plutôt que de laisser
   croire que tout est en place. */
const manquantes = NON_REDISTRIBUABLES.filter(
  (n) => !fs.existsSync(path.join(CIBLE, n)),
);
if (manquantes.length && !listeSeule) {
  console.log(
    `\n  ⚠ Non fournies (aucune licence de redistribution) : ${manquantes.join(", ")}` +
      "\n    Le skill new-store s'en passe et applique ses propres règles de design.",
  );
}

if (!listeSeule) {
  console.log(
    `\n✔ ${installees} installée(s), ${conservees} conservée(s).` +
      "\n  Relancer Claude Code pour qu'il les prenne en compte.\n",
  );
}
