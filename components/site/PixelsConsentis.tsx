"use client";

import { useEffect, useState } from "react";
import PixelScripts from "./PixelScripts";
import type { PixelConfig } from "@/lib/pixels-types";
import { EVENEMENT_CONSENTEMENT, lireConsentement, type Consentement } from "@/lib/consentement";

/**
 * N'injecte les pixels QU'APRÈS un consentement explicite.
 *
 * ⚠️ C'EST LA PIÈCE QUI REND LE SITE CONFORME. Le bandeau ne fait qu'afficher
 * une question ; c'est ici que la réponse a un effet. Sans ce garde, les
 * scripts de mesure se chargeraient au premier rendu et le bandeau ne serait
 * qu'un décor — exactement ce que la CNIL sanctionne.
 *
 * ⚠️ Composant CLIENT : le serveur ne peut pas connaître le choix, stocké
 * dans le navigateur. Les pixels sont donc montés après hydratation, ce qui
 * décale la mesure de quelques centaines de millisecondes — c'est le prix de
 * la conformité, et il est sans effet sur le suivi des conversions.
 *
 * ⚠️ Il écoute l'événement de consentement : accepter fait apparaître les
 * pixels immédiatement, sans rechargement.
 */
export default function PixelsConsentis({ pixels }: { pixels: PixelConfig }) {
  const [choix, setChoix] = useState<Consentement | null>(null);

  useEffect(() => {
    setChoix(lireConsentement());
    const surChangement = (e: Event) =>
      setChoix((e as CustomEvent<Consentement | null>).detail);
    window.addEventListener(EVENEMENT_CONSENTEMENT, surChangement);
    return () => window.removeEventListener(EVENEMENT_CONSENTEMENT, surChangement);
  }, []);

  if (choix !== "accepte") return null;
  return <PixelScripts pixels={pixels} />;
}
