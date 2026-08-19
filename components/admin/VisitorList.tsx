"use client";

import { useEffect, useState } from "react";
import { getVisitors, type VisitorRow } from "@/lib/actions/analytics";
import { SOURCE_LABEL, type SourceVente } from "@/lib/attribution";

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
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-4">
        <h2 className="font-medium">Tous les visiteurs</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-8 text-sm text-muted">Aucun visiteur enregistré pour l&apos;instant.</p>
      ) : (
        <table className="w-full min-w-[38rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-6 py-3 font-medium">Visiteur</th>
              <th className="px-6 py-3 font-medium">Origine</th>
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
                <td className="px-6 py-3">
                  <Origine source={v.source} />
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

/**
 * Pastille d'origine — même code couleur que « Visiteurs en direct », pour
 * qu'un canal se reconnaisse d'un écran à l'autre.
 *
 * ⚠️ La couleur ne porte jamais l'information seule : le nom du canal est
 * toujours écrit à côté.
 */
const TEINTES: Partial<Record<SourceVente, string>> = {
  pinterest: "bg-red-50 text-red-700 border-red-200",
  snapchat: "bg-yellow-50 text-yellow-800 border-yellow-300",
  instagram: "bg-pink-50 text-pink-700 border-pink-200",
  facebook: "bg-blue-50 text-blue-700 border-blue-200",
  tiktok: "bg-neutral-100 text-neutral-800 border-neutral-300",
  google: "bg-emerald-50 text-emerald-700 border-emerald-200",
  publicite: "bg-violet-50 text-violet-700 border-violet-200",
  ia: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

function Origine({ source }: { source?: string }) {
  // Visiteur enregistré avant la mise en service : on n'invente pas une
  // origine, un tiret est plus honnête qu'un « Direct » faux.
  if (!source) return <span className="text-muted">—</span>;
  const cle = source as SourceVente;
  const libelle = SOURCE_LABEL[cle] ?? source;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[0.65rem] ${
        TEINTES[cle] ?? "border-line text-muted"
      }`}
    >
      {libelle}
    </span>
  );
}
