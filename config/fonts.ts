/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  POLICES DE LA BOUTIQUE                                          ║
 * ║                                                                  ║
 * ║  Le SEUL endroit où changer la typographie.                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ Pourquoi un fichier dédié : `next/font/google` exige des imports
 * STATIQUES, analysables à la compilation. Une police ne peut donc pas être
 * choisie depuis `brand.config.ts` au moment de l'exécution — il faut
 * remplacer l'import ci-dessous. C'est le piège classique : croire qu'on
 * change la typo en éditant la config, et ne rien voir bouger.
 *
 * Pour changer de police :
 *   1. remplacer les deux imports par les familles voulues
 *      (catalogue : https://fonts.google.com)
 *   2. adapter les `weight` disponibles pour CES familles — une graisse
 *      inexistante fait échouer le build
 *   3. ne toucher NI aux noms de variables CSS (`--font-heading`,
 *      `--font-body`), NI aux noms exportés : `tailwind.config.ts` et les
 *      classes `font-heading` / `font-body` en dépendent partout.
 */
import { Fraunces, Hanken_Grotesk } from "next/font/google";

/** Police des titres → variable CSS `--font-heading`. */
export const headingFont = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

/** Police du texte courant → variable CSS `--font-body`. */
export const bodyFont = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

/** Classes à poser sur `<html>` pour exposer les deux variables CSS. */
export const fontVariables = `${headingFont.variable} ${bodyFont.variable}`;
