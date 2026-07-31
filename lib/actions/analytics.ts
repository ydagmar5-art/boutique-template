"use server";

import { headers } from "next/headers";
import { hasSupabase, supabaseAdmin } from "@/lib/supabase/server";
import { listOrders } from "@/lib/actions/orders";
import { store } from "@/config/store.config";

const VISITS = store.db.visits;
const VISITORS = store.db.visitors;

/** Récupère IP + ville depuis les en-têtes (fournis par Vercel en production). */
async function geoFromHeaders(): Promise<{ ip?: string; city?: string }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip"))?.trim() || undefined;
    const rawCity = h.get("x-vercel-ip-city");
    const city = rawCity ? decodeURIComponent(rawCity) : undefined;
    return { ip, city };
  } catch {
    return {};
  }
}

/* ─────────── Tracking (appelé depuis le storefront) ─────────── */

export async function trackVisit(
  path: string,
  referrer: string | undefined,
  visitor: string,
): Promise<{ count: number; ip?: string; city?: string }> {
  if (path.startsWith("/admin") || !hasSupabase()) return { count: 0 };
  const sb = supabaseAdmin();
  let host: string | undefined;
  if (referrer) {
    try {
      host = new URL(referrer).host || undefined;
    } catch {
      host = undefined;
    }
  }
  const { ip, city } = await geoFromHeaders();
  await sb
    .from(VISITS)
    .insert({ path, referrer: host, visitor, type: "view", ip, city });
  const { data } = await sb
    .from(VISITORS)
    .select("count")
    .eq("id", visitor)
    .maybeSingle();
  const count = (data?.count ?? 0) + 1;
  await sb.from(VISITORS).upsert({
    id: visitor,
    last_seen: new Date().toISOString(),
    last_path: path,
    count,
    ip,
    city,
  });
  return { count, ip, city };
}

export async function trackEvent(
  type: string,
  path: string,
  visitor: string,
): Promise<void> {
  if (!hasSupabase()) return;
  await supabaseAdmin().from(VISITS).insert({ path, visitor, type });
}

/* ─────────── Agrégats historiques ─────────── */

export interface StatPoint {
  label: string;
  views: number;
  cartAdds: number;
  revenue: number; // centimes
}

export interface StatsResult {
  totalViews: number;
  uniqueVisitors: number;
  cartAdds: number;
  revenue: number;
  orders: number;
  series: StatPoint[];
  topPages: { path: string; count: number }[];
  topReferrers: { host: string; count: number }[];
}

const empty: StatsResult = {
  totalViews: 0,
  uniqueVisitors: 0,
  cartAdds: 0,
  revenue: 0,
  orders: 0,
  series: [],
  topPages: [],
  topReferrers: [],
};

export async function getStats(fromISO: string, toISO: string): Promise<StatsResult> {
  if (!hasSupabase()) return empty;
  const sb = supabaseAdmin();
  const from = new Date(fromISO);
  const to = new Date(toISO);

  const { data: visits } = await sb
    .from(VISITS)
    .select("ts,path,referrer,type,visitor")
    .gte("ts", from.toISOString())
    .lte("ts", to.toISOString())
    .limit(50000);
  const rows = visits ?? [];

  const views = rows.filter((r) => r.type === "view");
  const carts = rows.filter((r) => r.type === "cart_add");

  // Ventes depuis les commandes
  const allOrders = await listOrders();
  const orders = allOrders.filter((o) => {
    const t = new Date(o.date).getTime();
    return t >= from.getTime() && t <= to.getTime() && o.status !== "refunded";
  });

  // Buckets : horaires si <= 2 jours, sinon journaliers.
  const spanMs = to.getTime() - from.getTime();
  const hourly = spanMs <= 2 * 24 * 3600 * 1000;
  const step = hourly ? 3600 * 1000 : 24 * 3600 * 1000;
  const start = new Date(from);
  if (hourly) start.setMinutes(0, 0, 0);
  else start.setHours(0, 0, 0, 0);

  const series: StatPoint[] = [];
  for (let t = start.getTime(); t <= to.getTime(); t += step) {
    const end = t + step;
    const d = new Date(t);
    const label = hourly
      ? `${d.getHours()}h`
      : `${d.getDate()}/${d.getMonth() + 1}`;
    series.push({
      label,
      views: views.filter((r) => {
        const x = new Date(r.ts).getTime();
        return x >= t && x < end;
      }).length,
      cartAdds: carts.filter((r) => {
        const x = new Date(r.ts).getTime();
        return x >= t && x < end;
      }).length,
      revenue: orders
        .filter((o) => {
          const x = new Date(o.date).getTime();
          return x >= t && x < end;
        })
        .reduce((s, o) => s + o.total, 0),
    });
  }

  const tally = (arr: (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const x of arr) if (x) m.set(x, (m.get(x) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return {
    totalViews: views.length,
    uniqueVisitors: new Set(views.map((r) => r.visitor)).size,
    cartAdds: carts.length,
    revenue: orders.reduce((s, o) => s + o.total, 0),
    orders: orders.length,
    series,
    topPages: tally(views.map((r) => r.path))
      .slice(0, 8)
      .map(([path, count]) => ({ path, count })),
    topReferrers: tally(views.map((r) => r.referrer))
      .slice(0, 6)
      .map(([host, count]) => ({ host, count })),
  };
}

/* ─────────── Liste des visiteurs ─────────── */

export interface VisitorRow {
  id: string;
  count: number;
  lastPath: string;
  lastSeen: string;
  ip: string;
  city: string;
}

export async function getVisitors(limit = 50): Promise<VisitorRow[]> {
  if (!hasSupabase()) return [];
  const { data } = await supabaseAdmin()
    .from(VISITORS)
    .select("id,count,last_path,last_seen,ip,city")
    .order("last_seen", { ascending: false })
    .limit(limit);
  return (data ?? []).map((v) => ({
    id: v.id,
    count: v.count,
    lastPath: v.last_path ?? "—",
    lastSeen: v.last_seen,
    ip: v.ip ?? "—",
    city: v.city ?? "—",
  }));
}
