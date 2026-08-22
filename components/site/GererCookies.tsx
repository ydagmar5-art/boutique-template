"use client";

import { reinitialiserConsentement } from "@/lib/consentement";

/**
 * Lien de révocation, au pied de page.
 *
 * ⚠️ OBLIGATOIRE : le consentement doit pouvoir être RETIRÉ aussi facilement
 * qu'il a été donné (art. 7.3 du RGPD). Un bandeau qu'on ne peut plus
 * rouvrir rend le consentement irrévocable en pratique, ce qui suffit à le
 * priver de validité.
 *
 * Il efface le choix stocké : le bandeau réapparaît aussitôt, sans
 * rechargement, et les pixels se retirent si l'accord est annulé.
 */
export default function GererCookies({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={reinitialiserConsentement}
      className={className}
    >
      Gérer les traceurs
    </button>
  );
}
