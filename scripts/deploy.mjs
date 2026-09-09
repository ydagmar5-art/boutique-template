#!/usr/bin/env node
/**
 * Déploie la boutique sur l'hébergement Node.js de Hostinger, en CLI.
 *
 *   node scripts/deploy.mjs --domain maboutique.fr [--env] [--dry]
 *
 * Enchaîne les quatre étapes que Hostinger impose, dans cet ordre :
 *   1. (--env) pose les variables d'environnement depuis .env.local
 *   2. fabrique une archive du code source (sans node_modules ni .next)
 *   3. la téléverse dans public_html en TUS
 *   4. lance la construction Node.js et suit son journal
 *
 * ⚠️ C'est HOSTINGER qui construit, pas cette machine : l'archive contient
 * les sources, `npm install` et `npm run build` tournent sur le serveur.
 * Un `npm run build` local ne prouve donc rien du déploiement — il reste
 * indispensable pour attraper les erreurs de type avant de perdre dix
 * minutes à une construction distante qui échouera.
 *
 * ⚠️ LE DÉPLOIEMENT REMPLACE LE CONTENU DU SITE. Tout fichier écrit sur le
 * serveur hors de l'archive disparaît — d'où `MEDIA_DIR` hors de public_html
 * pour les photos envoyées depuis le back-office (cf. lib/db/media.ts).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RACINE = path.resolve(import.meta.dirname, "..");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1] ?? true]);
    return acc;
  }, []),
);
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const DRY = !!args.dry;
const domain = (typeof args.domain === "string" && args.domain) || process.env.BOUTIQUE_DOMAIN || "";
if (!domain) fail("--domain est obligatoire (le domaine du site chez Hostinger).");

/* ─────────── le CLI Hostinger ─────────── */

function hostinger(...a) {
  try {
    return execFileSync("hostinger", [...a, "--format", "json"], {
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    const detail = String(e.stderr || e.stdout || e.message).trim();
    if (/ENOENT/.test(detail))
      fail("CLI Hostinger introuvable.  brew install hostinger/tap/hostinger");
    throw new Error(detail);
  }
}
/** Les listes reviennent tantôt en {data:[…]}, tantôt en tableau nu. */
const json = (s) => {
  const v = JSON.parse(s);
  return v && typeof v === "object" && "data" in v ? v.data : v;
};

/* ─────────── 0. le compte d'hébergement ─────────── */

let account =
  (typeof args.account === "string" && args.account) ||
  process.env.BOUTIQUE_HOSTINGER_ACCOUNT ||
  "";
const sites = json(hostinger("hosting", "websites", "list"));
const site = (Array.isArray(sites) ? sites : []).find((s) => s.domain === domain);
if (!site) {
  fail(
    `Aucun site « ${domain} » sur ce compte Hostinger.\n` +
      `  Sites connus : ${(sites || []).map((s) => s.domain).join(", ") || "aucun"}\n` +
      `  Pour le créer :  hostinger hosting websites create --domain ${domain} --order-id <id> [--datacenter-code frankfurt]\n` +
      "  ⚠️ La création est ASYNCHRONE : le site n'apparaît qu'au bout de quelques minutes.",
  );
}
account = account || site.username;
console.log(`▸ ${domain} · compte ${account}`);

/* ─────────── 1. variables d'environnement ─────────── */

if (args.env) {
  const envPath = path.join(RACINE, ".env.local");
  if (!fs.existsSync(envPath)) fail(".env.local introuvable.");
  const vars = [];
  for (const ligne of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (value) vars.push({ name: m[1], value });
  }

  /* ⚠️ Contrôles qui évitent une boutique en ligne et cassée. */
  const val = (n) => vars.find((v) => v.name === n)?.value || "";
  if (/localhost/.test(val("NEXT_PUBLIC_SITE_URL")))
    fail(
      "NEXT_PUBLIC_SITE_URL pointe encore sur localhost : les e-mails de commande\n" +
        "  et les retours de paiement mèneraient à une adresse morte.",
    );
  if (!val("AUTH_SECRET"))
    fail("AUTH_SECRET manquant : le gérant serait déconnecté du back-office à chaque déploiement.");
  if (!val("MEDIA_DIR"))
    console.warn(
      `  ⚠ MEDIA_DIR absent : les photos envoyées depuis le back-office iront\n` +
        `    dans le dossier de l'application et SERONT EFFACÉES au prochain\n` +
        `    déploiement. Valeur attendue : /home/${account}/media/<prefixe>`,
    );

  console.log(`▸ ${vars.length} variables d'environnement`);
  console.log("  ⚠️ Remplacement INTÉGRAL : ce qui n'est pas dans .env.local est supprimé.");
  if (!DRY) {
    hostinger(
      "hosting", "nodejs", "replace-environment-variables", account, domain,
      "--env-vars", JSON.stringify(vars),
    );
    console.log("  ✓ posées (elles ne prendront effet qu'à la construction suivante)");
  }
}

/* ─────────── 2. l'archive ─────────── */

const EXCLUS = new Set([
  "node_modules", ".next", ".git", "data", "media", ".env.local", ".env",
  "tsconfig.tsbuildinfo", "graphify-out", ".DS_Store", "out", "build",
]);
const travail = fs.mkdtempSync(path.join(os.tmpdir(), "boutique-deploy-"));
const source = path.join(travail, "app");
fs.cpSync(RACINE, source, {
  recursive: true,
  filter: (src) => !EXCLUS.has(path.basename(src)),
});
const archive = path.join(travail, "app.zip");

/* Pas de bibliothèque de compression : `zip` existe sur macOS et Linux,
   `Compress-Archive` sur Windows. Une dépendance de plus alourdirait
   l'installation de CHAQUE boutique pour un usage ponctuel. */
if (process.platform === "win32") {
  execFileSync("powershell", [
    "-NoProfile", "-Command",
    `Compress-Archive -Path '${source}\\*' -DestinationPath '${archive}' -Force`,
  ], { stdio: "pipe" });
} else {
  execFileSync("zip", ["-qr", archive, "."], { cwd: source, stdio: "pipe" });
}
const taille = fs.statSync(archive).size;
console.log(`▸ Archive : ${(taille / 1_048_576).toFixed(1)} Mo`);

if (DRY) {
  console.log(`\n(simulation) archive laissée ici : ${archive}\n`);
  process.exit(0);
}

/* ─────────── 3. téléversement TUS ─────────── */

const cred = json(
  hostinger("hosting", "files", "generate-upload-url", "--username", account, "--domain", domain),
);
/* ⚠️ Ces deux commandes voisines ne s'appellent PAS de la même façon :
   `generate-upload-url` prend des DRAPEAUX, `start-build` des positionnels.
   Le message d'erreur ne dit jamais laquelle des deux formes est attendue. */
const base = cred.url || cred.upload_url;
const enTetes = {
  "X-Auth": cred.auth_key,
  "X-Auth-Rest": cred.rest_auth_key,
  "Tus-Resumable": "1.0.0",
};
const cible = `${base.replace(/\/$/, "")}/app.zip?override=true`;

const creation = await fetch(cible, {
  method: "POST",
  headers: { ...enTetes, "Upload-Length": String(taille), "Upload-Offset": "0" },
});
if (creation.status !== 201)
  fail(`Téléversement refusé (${creation.status}) : ${await creation.text()}`);

const envoi = await fetch(cible, {
  method: "PATCH",
  headers: {
    ...enTetes,
    "Content-Type": "application/offset+octet-stream",
    "Upload-Offset": "0",
  },
  body: fs.readFileSync(archive),
});
if (!envoi.ok) fail(`Téléversement interrompu (${envoi.status}) : ${await envoi.text()}`);
console.log("▸ Archive déposée dans public_html");

/* ─────────── 4. construction ─────────── */

console.log("▸ Construction (npm install + next build, sur le serveur)");
console.log("  ⚠️ Elle REMPLACE le contenu actuel du site. Irréversible.");
const lance = json(
  hostinger(
    "hosting", "nodejs", "start-build", account, domain,
    "--source-type", "archive",
    "--source-options", JSON.stringify({ archive_path: "app.zip" }),
    "--app-type", "next",
    "--node-version", "22",
    "--package-manager", "npm",
    "--build-script", "build",
    "--output-directory", ".next",
  ),
);
const uuid = lance.uuid || lance.id;
if (!uuid) fail(`Construction non démarrée : ${JSON.stringify(lance)}`);

let ligne = 1;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 10_000));
  let etat;
  try {
    etat = json(hostinger("hosting", "nodejs", "build", account, domain, uuid));
  } catch {
    continue; // une construction toute neuve peut répondre 404 quelques secondes
  }
  try {
    const logs = json(
      hostinger("hosting", "nodejs", "build-logs", account, domain, uuid, "--from-line", String(ligne)),
    );
    for (const l of logs.logs || logs || []) {
      console.log("  │ " + (typeof l === "string" ? l : l.message || JSON.stringify(l)));
      ligne += 1;
    }
  } catch {
    /* journal pas encore disponible */
  }
  const statut = etat.state || etat.status;
  if (statut === "completed") {
    console.log(`\n✔ En ligne : https://${domain}\n`);
    console.log("  À vérifier maintenant, dans cet ordre :");
    console.log("    1. l'accueil, une fiche produit, le panier, le paiement");
    console.log("    2. /admin — si vous êtes déconnecté, AUTH_SECRET manque");
    console.log("    3. une photo envoyée depuis le back-office survit-elle ? (MEDIA_DIR)");
    console.log(`    4. journal d'exécution : hostinger hosting nodejs runtime-logs ${account} ${domain} --period 1h`);
    process.exit(0);
  }
  if (statut === "failed") {
    console.error("\n✖ Construction en échec. Journal complet :");
    console.error(`  hostinger hosting nodejs build-logs ${account} ${domain} ${uuid}`);
    console.error(`  Diagnostic assisté : hostinger hosting nodejs analyse-failed-build ${account} ${domain} ${uuid}`);
    process.exit(1);
  }
}
fail("Construction toujours en cours au bout de 20 minutes — suivre avec `hosting nodejs list-builds`.");
