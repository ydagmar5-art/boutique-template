"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EVENEMENT_CONSENTEMENT,
  enregistrerConsentement,
  lireConsentement,
  type Consentement,
} from "@/lib/consentement";

/**
 * Bandeau de consentement aux traceurs.
 *
 * ⚠️ DEUX BOUTONS DE MÊME POIDS. « Refuser » n'est ni un lien discret ni un
 * gris pâle : même taille, même hauteur, côte à côte. La CNIL sanctionne
 * explicitement les bandeaux où refuser demande plus d'efforts qu'accepter.
 *
 * ⚠️ AUCUN TRACEUR n'est chargé tant que ce bandeau n'a pas reçu de réponse
 * — c'est `PixelsConsentis` qui s'en assure, pas ce composant.
 *
 * ⚠️ Pas de fermeture par croix : une croix n'est ni un consentement ni un
 * refus, et laisserait le visiteur dans un état indéterminé à chaque page.
 * Le choix est explicite, et révocable depuis le pied de page.
 *
 * ⚠️ Le bandeau ne s'affiche qu'APRÈS montage : le rendu serveur ne connaît
 * pas le choix stocké côté client, et l'afficher d'emblée le ferait
 * clignoter chez les visiteurs qui ont déjà répondu.
 */
export default function Consentement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(lireConsentement() === null);
    const surChangement = (e: Event) => {
      const detail = (e as CustomEvent<Consentement | null>).detail;
      setVisible(detail === null);
    };
    window.addEventListener(EVENEMENT_CONSENTEMENT, surChangement);
    return () => window.removeEventListener(EVENEMENT_CONSENTEMENT, surChangement);
  }, []);

  if (!visible) return null;

  const repondre = (valeur: Consentement) => {
    enregistrerConsentement(valeur);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Consentement aux traceurs"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/97 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:gap-10">
        <div className="lg:flex-1">
          <p className="font-heading text-[1rem] font-bold tracking-[-0.02em]">
            Nous mesurons l&apos;audience de ce site.
          </p>
          <p className="mt-1.5 text-[0.92rem] leading-[1.55] text-muted">
            Ces statistiques nous disent quelles pages sont lues et d&apos;où
            viennent nos visiteurs. Elles ne sont pas nécessaires au
            fonctionnement de la boutique : sans votre accord, aucune mesure
            n&apos;est effectuée et vous pouvez commander normalement.{" "}
            <Link
              href="/confidentialite"
              className="font-semibold text-primary underline underline-offset-4"
            >
              En savoir plus
            </Link>
          </p>
        </div>

        {/* ⚠️ Ordre et poids identiques : refuser d'abord, accepter ensuite,
            mêmes dimensions. Aucun des deux n'est mis en avant. */}
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => repondre("refuse")}
            className="flex-1 rounded-full border border-line bg-surface px-7 py-3 font-heading text-[0.92rem] font-bold text-ink transition-colors hover:border-ink lg:flex-none"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => repondre("accepte")}
            className="flex-1 rounded-full border border-ink bg-ink px-7 py-3 font-heading text-[0.92rem] font-bold text-bg transition-colors hover:bg-primary hover:border-primary lg:flex-none"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
