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
  /* Chemin courant, lu par le battement sans le faire dépendre de `pathname` —
     sinon chaque navigation recréerait le canal. */
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  /*
    Charge utile de présence, en un seul endroit : elle part de trois points
    (abonnement, battement, après enregistrement de la visite) et trois copies
    divergeaient au premier champ ajouté.

    ⚠️ `memoriserSource()` est rappelé ici alors qu'il l'est déjà plus bas.
    C'est VOULU : l'effet de présence est déclaré AVANT celui qui mémorise
    l'origine, et un abonnement établi trop tôt renverrait « direct » pour une
    visiteuse pourtant venue d'une campagne. L'appel est sans effet si
    l'origine est déjà connue — il ne peut pas écraser le premier contact.
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
      ⚠️ Sans lui, `since` ne bouge plus dès qu'une visiteuse reste sur la même
      page, et le back-office ne peut pas distinguer « toujours là » de
      « partie sans que Supabase ait signalé son départ ». Un onglet fermé
      brutalement, une coupure réseau ou une mise en veille ne produisent pas
      toujours d'événement `leave` : le fantôme restait affiché jusqu'au
      rechargement du tableau de bord.
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

  // À chaque changement de page : enregistre la visite + met à jour la présence.
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    // Avant tout filtrage : l'origine se lit sur la page d'ARRIVÉE.
    memoriserSource();
    // Sans Supabase, l'effet de présence sort avant d'avoir posé la
    // référence : `presence()` émettrait un identifiant vide.
    const vid = vidRef.current || (vidRef.current = getVisitorId());
    trackVisit(pathname, document.referrer || undefined, vid)
      .then((res) => {
        countRef.current = res.count;
        geoRef.current = { ip: res.ip, city: res.city };
        channelRef.current?.track(
          presence({ count: res.count, ip: res.ip, city: res.city }),
        );
      })
      .catch(() => {});
  }, [pathname]);

  return null;
}
