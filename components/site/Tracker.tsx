"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVisit } from "@/lib/actions/analytics";
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
    return () => {
      sb.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // À chaque changement de page : enregistre la visite + met à jour la présence.
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
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
