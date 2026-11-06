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
 * ⚠️ FENÊTRE AU MILIEU DE L'ÉCRAN, pas un bandeau en bas : posé en bas, il
 * était ignoré, les visiteurs faisaient défiler sans répondre et la mesure
 * d'audience restait vide (constaté sur Casa Pilates). Le fond est assombri
 * et la page ne défile plus tant qu'il n'y a pas de réponse. Ce n'est PAS un
 * mur de cookies : « Refuser » est là, au même niveau, et ouvre la boutique
 * exactement comme « Accepter ».
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

  /* La fenêtre recouvre l'écran : la page derrière ne défile plus tant que
     le visiteur n'a pas répondu. */
  useEffect(() => {
    if (!visible) return;
    const html = document.documentElement;
    const avant = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = avant;
    };
  }, [visible]);

  if (!visible) return null;

  const repondre = (valeur: Consentement) => {
    enregistrerConsentement(valeur);
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 backdrop-blur-[3px]"
      style={{
        /* `bg-ink/55` ne sort rien : la couleur est une variable CSS en hexa,
           Tailwind 3 ne sait pas lui ajouter d'opacité. `bg-black/50` reste
           en secours pour les navigateurs sans color-mix. */
        background: "color-mix(in srgb, var(--c-ink) 55%, transparent)",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consentement-titre"
        aria-describedby="consentement-texte"
        className="max-h-full w-full max-w-[26rem] overflow-y-auto rounded-2xl border border-line bg-bg p-6 shadow-2xl sm:p-7"
      >
        <p
          id="consentement-titre"
          className="font-heading text-[1.15rem] font-bold tracking-[-0.02em]"
        >
          Nous mesurons l&apos;audience de ce site.
        </p>
        <p id="consentement-texte" className="mt-2.5 text-[0.92rem] leading-[1.55] text-muted">
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

        {/* ⚠️ Ordre et poids identiques : refuser d'abord, accepter ensuite,
            mêmes dimensions. Aucun des deux n'est mis en avant. */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => repondre("refuse")}
            className="flex-1 rounded-full border border-line bg-surface px-5 py-3 font-heading text-[0.92rem] font-bold text-ink transition-colors hover:border-ink"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => repondre("accepte")}
            className="flex-1 rounded-full border border-ink bg-ink px-5 py-3 font-heading text-[0.92rem] font-bold text-bg transition-colors hover:border-primary hover:bg-primary"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
