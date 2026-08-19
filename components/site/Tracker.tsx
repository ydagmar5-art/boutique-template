"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVisit } from "@/lib/actions/analytics";
import { memoriserSource, sourceMemorisee } from "@/lib/cart/store";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { store } from "@/config/store.config";

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(store.cookies.visitor);
    if (!id) {
      id =
        (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
      localStorage.setItem(store.cookies.visitor, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export default function Tracker() {
  const pathname = usePathname();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const countRef = useRef<number>(0);
  const vidRef = useRef<string>("");
  const geoRef = useRef<{ ip?: string; city?: string }>({});
  /* Chemin courant, lu par le battement de présence sans le faire dépendre
     de `pathname` — sinon chaque navigation recréerait le canal. */
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  /*
    Charge utile de présence, en un seul endroit : elle part de trois points
    (à l'abonnement, au battement, après l'enregistrement de la visite) et
    trois copies divergeaient au premier champ ajouté.

    ⚠️ `memoriserSource()` est rappelé ici alors qu'il l'est déjà plus bas.
    C'est VOULU : l'effet de présence est déclaré avant celui qui mémorise
    l'origine, et un abonnement établi trop tôt renverrait « direct » pour une
    visiteuse pourtant venue de Pinterest. L'appel est sans effet si l'origine
    est déjà connue — il ne peut donc pas écraser la première origine.
  */
  const presence = (extra?: { count?: number; ip?: string; city?: string }) => {
    memoriserSource();
    return {
      id: vidRef.current.slice(0, 8),
      path: pathRef.current,
      count: extra?.count ?? countRef.current,
      ip: extra?.ip ?? geoRef.current.ip,
      city: extra?.city ?? geoRef.current.city,
      source: sourceMemorisee(),
      since: Date.now(),
    };
  };

  // Présence temps réel : rejoint le canal une seule fois.
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const sb = supabaseBrowser();
    if (!sb) return;
    const vid = getVisitorId();
    vidRef.current = vid;
    const channel = sb.channel(store.realtimeChannel, {
      config: { presence: { key: vid } },
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") channel.track(presence());
    });
    channelRef.current = channel;

    /*
      ── BATTEMENT DE PRÉSENCE ──
      ⚠️ Sans lui, `since` ne bouge plus dès qu'une visiteuse reste sur la
      même page, et le back-office ne peut pas distinguer « toujours là » de
      « partie sans que Supabase ait signalé son départ ». Un onglet fermé
      brutalement, une coupure réseau ou une mise en veille ne produisent pas
      toujours d'événement `leave` : le fantôme restait affiché jusqu'au
      rechargement du tableau de bord.

      15 s : assez fréquent pour qu'un départ se voie en moins d'une minute,
      assez rare pour rester négligeable (un message websocket minuscule).
    */
    const battement = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      channelRef.current?.track(presence());
    }, 15_000);

    return () => {
      window.clearInterval(battement);
      sb.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    À chaque changement de page : enregistre la visite + met à jour la présence.

    ⚠️ TROIS GARDE-FOUS ANTI-ROBOTS, en plus du filtre serveur sur l'agent
    utilisateur (`lib/analytics/bots.ts`) :

    1. `navigator.webdriver` — vrai sur un navigateur piloté par Puppeteer,
       Playwright ou Selenium, y compris quand il usurpe un agent Chrome.

    2. Onglet réellement VISIBLE — écarte les préchargements spéculatifs et
       les rendus hors écran, qui n'ont jamais été des visites.

    3. Un DÉLAI de 1,2 seconde avant d'enregistrer. C'est le filtre le plus
       efficace contre les scrapeurs qui se déguisent : ils chargent, prennent
       leur instantané et repartent en quelques centaines de millisecondes,
       donc le minuteur ne se déclenche jamais. Une personne qui regarde une
       page reste, elle, largement au-delà.

    Coût de ce délai : une visiteuse qui quitte en moins de 1,2 s n'est pas
    comptée. C'est assumé — un rebond aussi rapide n'est pas une visite, et
    mieux vaut sous-compter honnêtement que gonfler le taux de conversion.
  */
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    // Avant tout filtrage : l'origine se lit sur la page d'ARRIVÉE.
    memoriserSource();
    if (typeof navigator !== "undefined" && navigator.webdriver) return;

    let annule = false;

    const enregistrer = () => {
      if (annule || document.visibilityState !== "visible") return;
      // Sans Supabase, l'effet de présence sort avant d'avoir posé la
      // référence : `presence()` émettrait un identifiant vide.
      const vid = vidRef.current || (vidRef.current = getVisitorId());
      trackVisit(pathname, document.referrer || undefined, vid, sourceMemorisee())
        .then((res) => {
          if (annule) return;
          countRef.current = res.count;
          geoRef.current = { ip: res.ip, city: res.city };
          channelRef.current?.track(
            presence({ count: res.count, ip: res.ip, city: res.city }),
          );
        })
        .catch(() => {});
    };

    const minuteur = window.setTimeout(enregistrer, 1200);
    return () => {
      annule = true;
      window.clearTimeout(minuteur);
    };
  }, [pathname]);

  return null;
}
