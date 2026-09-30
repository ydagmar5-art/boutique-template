#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ACTIVE L'ENVOI DES VENTES À GOOGLE ANALYTICS PAR LE SERVEUR     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * À lancer UNE SEULE FOIS, par le gérant lui-même (la clé est un secret) :
 *
 *     node scripts/activer-suivi-serveur.mjs \
 *       --propriete 123456789 --flux 9876543210 --mesure G-XXXXXXXXXX \
 *       --projet <projet-google-cloud>
 *
 * Les quatre valeurs se lisent dans GA4 : Administration → Propriété
 * (numéro), Flux de données → le flux Web (identifiant du flux et ID de
 * mesure G-…) ; le projet est celui de gcloud (`gcloud config get project`).
 *
 * Ce que fait ce script, tout seul :
 *   1. vérifie que votre compte Google autorise la modification d'Analytics ;
 *   2. crée la clé du « protocole de mesure » sur le flux de la boutique ;
 *   3. l'enregistre dans .env.local (et chez Vercel si le projet y est lié ;
 *      chez Hostinger, renvoyer ensuite le jeu COMPLET des variables) ;
 *   4. envoie un achat FICTIF à l'adresse de validation de Google, qui
 *      contrôle le format SANS rien enregistrer, puis affiche le verdict.
 *
 * ⚠️ LA CLÉ N'EST JAMAIS AFFICHÉE. Elle passe du serveur de Google à vos
 * fichiers sans jamais apparaître à l'écran ni dans une conversation.
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(import.meta.dirname, "..");
const arg = (nom) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 ? String(process.argv[i + 1] ?? "").trim() : "";
};
const PROPRIETE = arg("propriete");
const FLUX = arg("flux");
const ID_MESURE = arg("mesure");
const PROJET = arg("projet");
if (!/^\d+$/.test(PROPRIETE) || !/^\d+$/.test(FLUX) || !/^G-[A-Z0-9]+$/.test(ID_MESURE) || !PROJET) {
  console.error(
    "Usage : node scripts/activer-suivi-serveur.mjs --propriete <n°> --flux <n°> --mesure G-XXXX --projet <projet gcloud>\n" +
      "⚠️ Une propriété GA4 PAR BOUTIQUE : ne jamais réutiliser celle d'une autre.",
  );
  process.exit(1);
}
const GCLOUD = ["/opt/homebrew/bin/gcloud", "/usr/local/bin/gcloud", "/usr/bin/gcloud"].find((f) => fs.existsSync(f)) ?? "gcloud";
const LIEE_A_VERCEL = fs.existsSync(path.join(RACINE, ".vercel", "project.json"));

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.edit",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/cloud-platform",
].join(",");

function jeton() {
  return execFileSync(GCLOUD, ["auth", "application-default", "print-access-token"], {
    encoding: "utf8",
  }).trim();
}

async function creerLaCle(token) {
  const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${PROPRIETE}/dataStreams/${FLUX}/measurementProtocolSecrets`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-user-project": PROJET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName: "Serveur boutique" }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data).slice(0, 200);
    return { erreur: msg, code: res.status };
  }
  return { secret: data.secretValue };
}

function ecrireEnvLocal(secret) {
  const fichier = path.join(RACINE, ".env.local");
  let contenu = fs.existsSync(fichier) ? fs.readFileSync(fichier, "utf8") : "";
  contenu = contenu
    .split("\n")
    .filter((l) => !/^GA_API_SECRET=|^GA_MEASUREMENT_ID=/.test(l))
    .join("\n")
    .replace(/\n+$/, "");
  contenu += `\nGA_MEASUREMENT_ID=${ID_MESURE}\nGA_API_SECRET=${secret}\n`;
  fs.writeFileSync(fichier, contenu, { mode: 0o600 });
}

function poserChezVercel(nom, valeur) {
  try {
    execSync(`npx vercel env rm ${nom} production --yes`, { cwd: RACINE, stdio: "ignore" });
  } catch {
    /* la variable n'existait pas : c'est très bien */
  }
  execSync(`npx vercel env add ${nom} production`, {
    cwd: RACINE,
    input: valeur,
    stdio: ["pipe", "ignore", "ignore"],
  });
}

async function valider(secret) {
  const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${ID_MESURE}&api_secret=${secret}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "1234567890.1234567890",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: "VALIDATION-FORMAT",
            value: 64,
            currency: "EUR",
            engagement_time_msec: 1,
            items: [{ item_id: "validation", item_name: "Validation", price: 64, quantity: 1 }],
          },
        },
      ],
    }),
  });
  return res.json();
}

const etape = (n, texte) => console.log(`\n[${n}/4] ${texte}`);

try {
  etape(1, "Vérification de l'autorisation Google…");
  let token;
  try {
    token = jeton();
  } catch {
    console.log("    Aucune autorisation trouvée.");
    token = null;
  }

  let creation = token ? await creerLaCle(token) : { code: 401, erreur: "pas de jeton" };

  if (creation.erreur && (creation.code === 401 || creation.code === 403)) {
    console.log("    Autorisation insuffisante : la fenêtre Google va s'ouvrir.");
    console.log("    Choisissez votre compte, puis cliquez « Continuer » et « Autoriser ».\n");
    /* Client OAuth du MCP Analytics s'il est installé (les portées Analytics
       sont refusées au client gcloud par défaut), sinon celui de gcloud. */
    const client = path.join(process.env.HOME ?? "", ".config/analytics-mcp/client_oauth.json");
    execSync(
      `${GCLOUD} auth application-default login --scopes=${SCOPES}` +
        (fs.existsSync(client) ? ` --client-id-file="${client}"` : ""),
      { stdio: "inherit" },
    );
    creation = await creerLaCle(jeton());
  }

  /*
    Google exige une ATTESTATION sur la propriété avant d'autoriser ce type de
    clé. C'est une déclaration juridique : elle engage le gérant, pas l'outil.
    On l'affiche en entier et on exige une réponse tapée à la main.
  */
  if (creation.erreur && /User Data Collection Acknowledgement/i.test(creation.erreur)) {
    console.log(`
────────────────────────────────────────────────────────────────────
  ATTESTATION DEMANDÉE PAR GOOGLE, À VALIDER PAR VOUS

  En continuant, vous déclarez à Google :

  « Je reconnais disposer des mentions d'information et des droits
    nécessaires, obtenus auprès de mes utilisateurs finaux, pour la
    collecte et le traitement de leurs données, y compris l'association
    de ces données aux informations de visite recueillies par Google
    Analytics sur mon site. »

  Concrètement : votre politique de confidentialité doit informer vos
  visiteurs de la mesure d'audience. Vérifiez-le AVANT de taper OUI.
────────────────────────────────────────────────────────────────────
`);
    const reponse = (
      await new Promise((r) => {
        process.stdout.write("  Tapez OUI pour attester, autre chose pour annuler : ");
        process.stdin.setEncoding("utf8");
        process.stdin.once("data", (d) => r(String(d)));
      })
    )
      .trim()
      .toUpperCase();
    if (reponse !== "OUI") {
      console.log("\n  Annulé. Aucune attestation envoyée.");
      process.exit(1);
    }
    const token2 = jeton();
    const res = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${PROPRIETE}:acknowledgeUserDataCollection`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token2}`,
          "x-goog-user-project": PROJET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acknowledgement:
            "I acknowledge that I have the necessary privacy disclosures and rights from my end users for the collection and processing of their data, including the association of such data with the visitation information Google Analytics collects from my site and/or app property.",
        }),
      },
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      console.error(`\n❌ Attestation refusée : ${d?.error?.message ?? res.status}`);
      process.exit(1);
    }
    console.log("\n    Attestation enregistrée. Nouvelle tentative de création de la clé…");
    creation = await creerLaCle(jeton());
  }

  if (creation.erreur) {
    console.error(`\n❌ Google a refusé la création de la clé : ${creation.erreur}`);
    process.exit(1);
  }

  etape(2, "Clé créée sur le flux de la boutique. Enregistrement en local…");
  ecrireEnvLocal(creation.secret);

  if (LIEE_A_VERCEL) {
    etape(3, "Enregistrement chez Vercel (production)…");
    poserChezVercel("GA_MEASUREMENT_ID", ID_MESURE);
    poserChezVercel("GA_API_SECRET", creation.secret);
  } else {
    etape(
      3,
      "Hébergement hors Vercel : GA_MEASUREMENT_ID et GA_API_SECRET sont dans .env.local.\n" +
        "    Chez Hostinger, renvoyer le jeu COMPLET des variables de l'application (une variable\n" +
        "    absente de l'envoi est supprimée), puis reconstruire.",
    );
  }

  etape(4, "Validation du format auprès de Google (rien n'est enregistré)…");
  const verdict = await valider(creation.secret);
  const soucis = verdict?.validationMessages ?? [];
  if (soucis.length === 0) {
    console.log("    ✅ Google accepte l'envoi : aucun problème de format.");
  } else {
    console.log("    ⚠️ Google signale :");
    for (const m of soucis) console.log("      -", m.description ?? JSON.stringify(m));
  }

  console.log(
    "\nTerminé. La clé est en place, elle n'a jamais été affichée.\n" +
      "Dites-le à Claude : il republiera le site et vérifiera sur une vraie commande.\n",
  );
} catch (e) {
  console.error("\n❌ Échec :", e?.message ?? e);
  process.exit(1);
}
