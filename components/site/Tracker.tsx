"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVisit } from "@/lib/actions/analytics";
import { memoriserSource } from "@/lib/cart/store";
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
      if (status === "SUBSCRIBED") {
        channel.track({
          id: vid.slice(0, 8),
          path: pathname,
          count: countRef.current,
          ip: geoRef.current.ip,
          city: geoRef.current.city,
          since: Date.now(),
        });
      }
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
      channelRef.current?.track({
        id: vid.slice(0, 8),
        path: pathRef.current,
        count: countRef.current,
        ip: geoRef.current.ip,
        city: geoRef.current.city,
        since: Date.now(),
      });
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
    const vid = vidRef.current || getVisitorId();
    trackVisit(pathname, document.referrer || undefined, vid)
      .then((res) => {
        countRef.current = res.count;
        geoRef.current = { ip: res.ip, city: res.city };
        channelRef.current?.track({
          id: vid.slice(0, 8),
          path: pathname,
          count: res.count,
          ip: res.ip,
          city: res.city,
          since: Date.now(),
        });
      })
      .catch(() => {});
  }, [pathname]);

  return null;
}
