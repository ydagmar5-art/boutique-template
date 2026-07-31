"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Next.js navigue côté client : les scripts de pixels ne se rejouent pas, et
 * une session entière ne compterait qu'une seule vue de page (celle du premier
 * chargement). On renvoie donc le PageView à chaque changement d'URL.
 *
 * GA4 est volontairement absent : sa "mesure améliorée" suit déjà les
 * changements d'historique, l'ajouter créerait des doublons.
 */
export default function RouteChangePixel() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // Le premier PageView est déjà envoyé par les scripts d'init.
    if (first.current) {
      first.current = false;
      return;
    }
    const w = window as any;
    try {
      w.fbq?.("track", "PageView");
    } catch {}
    try {
      w.ttq?.page?.();
    } catch {}
    try {
      w.snaptr?.("track", "PAGE_VIEW");
    } catch {}
    try {
      w.pintrk?.("page");
    } catch {}
  }, [pathname]);

  return null;
}
