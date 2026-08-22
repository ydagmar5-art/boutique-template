/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CONSENTEMENT AUX TRACEURS                                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ CONSENTEMENT PRÉALABLE. Les traceurs non essentiels — mesure d'audience
 * et pixels publicitaires — ne doivent PAS être déposés avant un acte
 * positif du visiteur (art. 82 de la loi Informatique et Libertés). Charger
 * `gtag.js` puis « demander » ensuite est la non-conformité la plus
 * sanctionnée par la CNIL sur les sites marchands.
 *
 * ⚠️ REFUSER DOIT ÊTRE AUSSI SIMPLE QU'ACCEPTER : deux boutons de même
 * niveau, sur le même écran. Un bandeau où « Tout accepter » est un bouton
 * plein et le refus un lien gris en bas est un « dark pattern » explicitement
 * visé par les délibérations de la CNIL.
 *
 * ⚠️ La mesure d'audience STRICTEMENT nécessaire peut être exemptée, mais
 * Google Analytics 4 ne l'est PAS : il alimente des services tiers. Il tombe
 * donc du côté « soumis au consentement ».
 *
 * Le choix vaut SIX MOIS (recommandation CNIL), après quoi la question est
 * reposée. Il est révocable à tout moment — le pied de page porte un lien
 * qui rouvre le panneau.
 */

import { store } from "@/config/store.config";

export type Consentement = "accepte" | "refuse";

/**
 * Clé de stockage.
 *
 * ⚠️ DÉRIVÉE DU PRÉFIXE DE LA BOUTIQUE, jamais écrite en dur. Elle l'a été,
 * et le nom d'une boutique s'est retrouvé dans le modèle puis dans toutes
 * celles qui en descendaient : un choix de traceurs enregistré sous le nom
 * d'une autre enseigne, impossible à relire après un changement de préfixe.
 */
export const CLE_CONSENTEMENT = `${store.prefix}_consentement`;

/** Six mois, en millisecondes. */
export const DUREE_CONSENTEMENT = 182 * 24 * 60 * 60 * 1000;

export interface ChoixEnregistre {
  valeur: Consentement;
  /** Horodatage du choix, pour la péremption à six mois. */
  date: number;
}

/** Lit le choix courant. `null` si absent, illisible ou périmé. */
export function lireConsentement(): Consentement | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_CONSENTEMENT);
    if (!brut) return null;
    const choix = JSON.parse(brut) as ChoixEnregistre;
    if (!choix?.valeur || typeof choix.date !== "number") return null;
    // Périmé : on repose la question plutôt que de prolonger indéfiniment.
    if (Date.now() - choix.date > DUREE_CONSENTEMENT) return null;
    return choix.valeur;
  } catch {
    // localStorage peut lever (navigation privée, quota, cookies bloqués).
    // Dans le doute, on considère qu'aucun consentement n'a été donné.
    return null;
  }
}

/** Nom de l'événement émis quand le choix change, pour que les composants
 *  déjà montés réagissent sans rechargement. */
export const EVENEMENT_CONSENTEMENT = `${store.prefix}:consentement`;

export function enregistrerConsentement(valeur: Consentement): void {
  try {
    const choix: ChoixEnregistre = { valeur, date: Date.now() };
    window.localStorage.setItem(CLE_CONSENTEMENT, JSON.stringify(choix));
  } catch {
    /* stockage indisponible : le choix ne survivra pas à la session */
  }
  window.dispatchEvent(new CustomEvent(EVENEMENT_CONSENTEMENT, { detail: valeur }));
}

/** Efface le choix : le bandeau réapparaît. */
export function reinitialiserConsentement(): void {
  try {
    window.localStorage.removeItem(CLE_CONSENTEMENT);
  } catch {
    /* rien à faire */
  }
  window.dispatchEvent(new CustomEvent(EVENEMENT_CONSENTEMENT, { detail: null }));
}
