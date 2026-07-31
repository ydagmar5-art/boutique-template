"use client";

import { useEffect, useState } from "react";
import { getVisitors, type VisitorRow } from "@/lib/actions/analytics";

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

export default function VisitorList() {
  const [rows, setRows] = useState<VisitorRow[]>([]);

  useEffect(() => {
    const load = () => getVisitors(50).then(setRows).catch(() => {});
    load();
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-4">
        <h2 className="font-medium">Tous les visiteurs</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-8 text-sm text-muted">Aucun visiteur enregistré pour l&apos;instant.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-6 py-3 font-medium">Visiteur</th>
              <th className="px-6 py-3 font-medium">Ville</th>
              <th className="px-6 py-3 font-medium">IP</th>
              <th className="px-6 py-3 font-medium">Passages</th>
              <th className="px-6 py-3 font-medium">Dernière page</th>
              <th className="px-6 py-3 text-right font-medium">Vu il y a</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-line">
                <td className="px-6 py-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-halo text-[10px] font-medium text-primary-dark">
                    {v.id.slice(0, 2).toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-3">{v.city}</td>
                <td className="px-6 py-3 font-mono text-xs text-muted">{v.ip}</td>
                <td className="px-6 py-3">
                  <span className="font-medium">{v.count}</span>
                  <span className="text-muted"> fois</span>
                </td>
                <td className="px-6 py-3 text-muted">{v.lastPath}</td>
                <td className="px-6 py-3 text-right text-muted">{ago(v.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
