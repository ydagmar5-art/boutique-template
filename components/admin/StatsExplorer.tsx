"use client";

import { useEffect, useMemo, useState } from "react";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { getStats, type StatsResult } from "@/lib/actions/analytics";

type PresetKey = "today" | "yesterday" | "7d" | "30d" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "custom", label: "Personnalisé" },
];

const iso = (d: Date) => d.toISOString();
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(preset: PresetKey, from: string, to: string): [string, string] {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (preset === "today") return [iso(start), iso(now)];
  if (preset === "yesterday") {
    const y0 = new Date(start);
    y0.setDate(y0.getDate() - 1);
    const y1 = new Date(start);
    y1.setMilliseconds(-1);
    return [iso(y0), iso(y1)];
  }
  if (preset === "7d") {
    const s = new Date(start);
    s.setDate(s.getDate() - 6);
    return [iso(s), iso(now)];
  }
  if (preset === "30d") {
    const s = new Date(start);
    s.setDate(s.getDate() - 29);
    return [iso(s), iso(now)];
  }
  // custom
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T23:59:59");
  return [iso(f), iso(t)];
}

const SERIES = [
  { key: "views" as const, label: "Audience", color: "#9A9B7E" },
  { key: "revenue" as const, label: "Ventes", color: "#D9954B" },
  { key: "cartAdds" as const, label: "Ajouts panier", color: "#BE6A47" },
];

export default function StatsExplorer({
  initial,
  live = false,
}: {
  initial?: StatsResult;
  live?: boolean;
}) {
  const [preset, setPreset] = useState<PresetKey>("7d");
  const today = dayStr(new Date());
  const weekAgo = dayStr(new Date(Date.now() - 6 * 864e5));
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState<StatsResult | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ views: true, revenue: true, cartAdds: true });

  const load = () => {
    const [f, t] = rangeFor(preset, from, to);
    setLoading(true);
    getStats(f, t)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (!live) return;
    const id = setInterval(load, 10000); // rafraîchit l'historique sans recharger
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, from, to, live]);

  const s = stats ?? {
    totalViews: 0, uniqueVisitors: 0, cartAdds: 0, revenue: 0, orders: 0,
    series: [], topPages: [], topReferrers: [],
  };

  return (
    <div className="space-y-5">
      {/* Sélecteur de période */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-line p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                preset === p.key ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-line bg-bg px-2 py-1.5 outline-none focus:border-primary" />
            <span className="text-muted">→</span>
            <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-line bg-bg px-2 py-1.5 outline-none focus:border-primary" />
          </div>
        )}
        {loading && <span className="text-xs text-muted">…</span>}
      </div>

      {/* Cartes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Vues" value={s.totalViews.toLocaleString("fr-FR")} />
        <Metric label="Visiteurs uniques" value={s.uniqueVisitors.toLocaleString("fr-FR")} />
        <Metric label="Ajouts panier" value={s.cartAdds.toLocaleString("fr-FR")} />
        <Metric label="Commandes" value={s.orders.toLocaleString("fr-FR")} />
        <Metric
          label="Taux de conversion"
          value={`${(s.uniqueVisitors > 0 ? (s.orders / s.uniqueVisitors) * 100 : 0).toFixed(1).replace(".", ",")} %`}
        />
        <Metric label="Chiffre d'affaires" value={formatPrice(s.revenue, brand.currency, brand.locale)} />
      </div>

      {/* Graphique combiné */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Évolution</h2>
          <div className="flex flex-wrap gap-4">
            {SERIES.map((ser) => (
              <label key={ser.key} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={show[ser.key]}
                  onChange={(e) => setShow((v) => ({ ...v, [ser.key]: e.target.checked }))}
                  className="accent-primary"
                />
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ser.color }} />
                {ser.label}
              </label>
            ))}
          </div>
        </div>
        <Chart series={s.series} show={show} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-heading text-2xl">{value}</p>
    </div>
  );
}

function Chart({
  series,
  show,
}: {
  series: StatsResult["series"];
  show: Record<string, boolean>;
}) {
  const W = 720;
  const H = 200;
  const pad = 8;
  if (series.length === 0)
    return <p className="py-10 text-center text-sm text-muted">Aucune donnée sur cette période.</p>;

  // Chaque série normalisée à son propre max (formes comparables sur un même graph).
  const line = (key: "views" | "revenue" | "cartAdds", color: string) => {
    const max = Math.max(1, ...series.map((p) => p[key]));
    const n = series.length;
    const pts = series.map((p, i) => {
      const x = pad + (i / Math.max(1, n - 1)) * (W - 2 * pad);
      const y = H - pad - (p[key] / max) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    );
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }}>
        {SERIES.filter((s) => show[s.key]).map((s) => (
          <g key={s.key}>{line(s.key, s.color)}</g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}
