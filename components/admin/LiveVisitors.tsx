"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { store } from "@/config/store.config";

interface Online {
  id: string;
  path: string;
  count: number;
  since: number;
  ip?: string;
  city?: string;
}

export default function LiveVisitors() {
  const [online, setOnline] = useState<Online[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    // clé "admin" pour observer sans être compté comme visiteur boutique
    const channel = sb.channel(store.realtimeChannel, {
      config: { presence: { key: "admin-" + Math.random().toString(36).slice(2, 8) } },
    });

    const sync = () => {
      const state = channel.presenceState<Online>();
      const list: Online[] = [];
      for (const key of Object.keys(state)) {
        if (key.startsWith("admin-")) continue; // exclut les admins
        const metas = state[key] as unknown as Online[];
        if (!metas?.length) continue;
        // Une même clé peut avoir plusieurs connexions (onglets/reloads) : on
        // garde la plus récente pour refléter la page actuelle.
        const meta = metas.reduce((a, b) => (b.since > a.since ? b : a));
        list.push(meta);
      }
      list.sort((a, b) => b.since - a.since);
      setOnline(list);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          channel.track({ id: "admin", path: "/admin", count: 0, since: Date.now() });
        }
      });

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-primary/40 bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full ${online.length ? "animate-ping bg-organic opacity-75" : ""}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online.length ? "bg-organic" : "bg-line"}`} />
          </span>
          <h2 className="font-medium">Visiteurs en direct</h2>
        </div>
        <span className="font-heading text-2xl">{online.length}</span>
      </div>

      {!connected ? (
        <p className="text-sm text-muted">Connexion au temps réel…</p>
      ) : online.length === 0 ? (
        <p className="text-sm text-muted">Personne sur la boutique en ce moment.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {online.map((v, i) => (
            <li key={i} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-halo text-[10px] font-medium text-primary-dark">
                  {v.id.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-ink">{v.path}</span>
                  <span className="block text-xs text-muted">
                    {v.city || "Ville inconnue"} · {v.ip || "IP inconnue"}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted">
                {v.count > 1 ? `${v.count}ᵉ visite` : "1ʳᵉ visite"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Mise à jour instantanée — la page qu&apos;ils regardent en temps réel.
      </p>
    </div>
  );
}
