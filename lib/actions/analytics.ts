"use server";

import { cookies, headers } from "next/headers";
import { hasSupabase, supabaseAdmin } from "@/lib/supabase/server";
import { listOrders } from "@/lib/actions/orders";
import { listProducts } from "@/lib/actions/products";
import { store } from "@/config/store.config";
import { isBotUserAgent } from "@/lib/analytics/bots";

const VISITS = store.db.visits;
const VISITORS = store.db.visitors;

/*
  ⚠️ TOLÉRANCE À LA COLONNE `source` MANQUANTE.

  L'origine du visiteur est arrivée après la création de la table. Sur une
  base déjà en service, la colonne n'existe qu'une fois la migration passée
  (voir `supabase/schema.sql`) — et PostgREST REJETTE toute la requête quand
  on écrit dans une colonne inconnue. Sans ce garde-fou, une boutique dont la
  migration n'a pas encore été jouée cesserait purement et simplement
  d'enregistrer ses visites : une panne silencieuse pour un simple ornement
  d'affichage.

  On tente donc AVEC l'origine, et on retombe sans elle une fois pour toutes.
*/
let colonneSource = true;

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

/**
 * Faut-il ignorer ce passage ?
 *
 * Deux motifs, tous deux vérifiés CÔTÉ SERVEUR — le navigateur peut mentir :
 *   · un agent utilisateur de robot ;
 *   · la présence du cookie de session admin, c'est-à-dire le gérant en train
 *     de parcourir sa propre boutique. Sans ça, chaque relecture de fiche
 *     produit avant une correction gonflait ses propres statistiques.
 *
 * ⚠️ On teste la PRÉSENCE du cookie, pas sa validité : il ne s'agit pas d'un
 * contrôle d'accès mais d'un filtre de mesure, et une signature expirée
 * désigne quand même le navigateur du gérant.
 */
async function ignorer(): Promise<boolean> {
  try {
    const h = await headers();
    if (isBotUserAgent(h.get("user-agent"))) return true;
    const c = await cookies();
    return c.has(store.cookies.session);
  } catch {
    return false;
  }
}

/* ─────────── Tracking (appelé depuis le storefront) ─────────── */

export async function trackVisit(
  path: string,
  referrer: string | undefined,
  visitor: string,
  /** Origine mémorisée par le navigateur à la toute première visite. */
  source?: string,
): Promise<{ count: number; ip?: string; city?: string }> {
  if (path.startsWith("/admin") || !hasSupabase()) return { count: 0 };
  if (await ignorer()) return { count: 0 };
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
  let existant: { count?: number; source?: string } | null = null;
  /* ⚠️ `lu` et non `!existant` : une visiteuse inconnue rend légitimement
     null, et retester sur la nullité relancerait une requête à chaque toute
     première visite. */
  let lu = false;
  if (colonneSource) {
    const r = await sb
      .from(VISITORS)
      .select("count,source")
      .eq("id", visitor)
      .maybeSingle();
    if (r.error) colonneSource = false;
    else {
      existant = r.data;
      lu = true;
    }
  }
  if (!lu) {
    const r = await sb.from(VISITORS).select("count").eq("id", visitor).maybeSingle();
    existant = r.data;
  }
  const count = (existant?.count ?? 0) + 1;

  const ligne: Record<string, unknown> = {
    id: visitor,
    last_seen: new Date().toISOString(),
    last_path: path,
    count,
    ip,
    city,
  };
  /* ⚠️ PREMIER CONTACT. `upsert` réécrit la ligne entière : sans cette garde,
     chaque retour d'une cliente écraserait son origine par celle du jour, et
     tout finirait attribué à « Direct ». L'origine déjà connue prime donc
     toujours sur celle qui remonte du navigateur. */
  if (colonneSource && (existant?.source || source)) {
    ligne.source = existant?.source || source;
  }

  const { error } = await sb.from(VISITORS).upsert(ligne);
  if (error && colonneSource) {
    // Migration pas encore jouée : on désarme et on réécrit sans l'origine.
    colonneSource = false;
    delete ligne.source;
    await sb.from(VISITORS).upsert(ligne);
  }
  return { count, ip, city };
}

export async function trackEvent(
  type: string,
  path: string,
  visitor: string,
): Promise<void> {
  if (!hasSupabase()) return;
  if (await ignorer()) return;
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
  /** Nombre TOTAL d'ajouts au panier — un même visiteur peut en faire dix. */
  cartAdds: number;
  /**
   * Nombre de PERSONNES distinctes ayant ajouté au panier.
   *
   * ⚠️ Sans ce second chiffre, « 10 ajouts » est ambigu : dix personnes
   * intéressées, ou une seule qui hésite. Ce sont deux situations opposées,
   * et elles n'appellent pas les mêmes décisions.
   */
  cartVisitors: number;
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
  cartVisitors: 0,
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
    cartVisitors: new Set(carts.map((r) => r.visitor).filter(Boolean)).size,
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
  /** Origine du PREMIER contact. Absente avant la migration, ou pour les
      visiteurs enregistrés avant sa mise en service. */
  source?: string;
}

export async function getVisitors(limit = 50): Promise<VisitorRow[]> {
  if (!hasSupabase()) return [];
  const sb = supabaseAdmin();
  let brut: unknown = null;
  if (colonneSource) {
    const r = await sb
      .from(VISITORS)
      .select("id,count,last_path,last_seen,ip,city,source")
      .order("last_seen", { ascending: false })
      .limit(limit);
    if (r.error) colonneSource = false; // migration pas encore jouée
    else brut = r.data;
  }
  if (!brut) {
    const r = await sb
      .from(VISITORS)
      .select("id,count,last_path,last_seen,ip,city")
      .order("last_seen", { ascending: false })
      .limit(limit);
    brut = r.data;
  }
  type Ligne = {
    id: string; count: number; last_path?: string | null; last_seen: string;
    ip?: string | null; city?: string | null; source?: string | null;
  };
  return ((brut ?? []) as Ligne[]).map((v) => ({
    id: v.id,
    count: v.count,
    lastPath: v.last_path ?? "—",
    lastSeen: v.last_seen,
    ip: v.ip ?? "—",
    city: v.city ?? "—",
    source: v.source ?? undefined,
  }));
}

/* ─────────── Entonnoir de conversion ─────────── */

export interface FunnelStep {
  key: "sessions" | "product" | "cart" | "checkout" | "purchase";
  label: string;
  /** Visiteurs DISTINCTS ayant atteint cette étape. */
  visitors: number;
  /** Part des sessions du haut de l'entonnoir. */
  shareOfSessions: number;
  /** Part de l'étape PRÉCÉDENTE — c'est là que se lisent les fuites. */
  shareOfPrevious: number;
}

export interface FunnelResult {
  steps: FunnelStep[];
  /** Taux de conversion global : commandes / sessions. */
  conversionRate: number;
  /**
   * Nombre de commandes réellement enregistrées sur la période.
   * Sert de contrôle : il doit rester proche de l'étape « Commande passée ».
   */
  ordersRecorded: number;
  /** Panier moyen, en centimes. */
  averageOrderValue: number;
}

const emptyFunnel: FunnelResult = {
  steps: [],
  conversionRate: 0,
  ordersRecorded: 0,
  averageOrderValue: 0,
};

/**
 * Entonnoir façon Shopify : sessions → fiche produit → panier → paiement →
 * commande, compté en VISITEURS DISTINCTS à chaque étape.
 *
 * ⚠️ Aucune nouvelle collecte n'a été ajoutée : tout se déduit du journal de
 * visites existant. Les étapes « fiche produit », « paiement » et « commande »
 * se lisent dans les CHEMINS visités, l'ajout au panier dans les événements
 * `cart_add` déjà émis par `lib/cart/store.ts`.
 *
 * ⚠️ L'étape « commande passée » est mesurée par la consultation de
 * `/order/…`, donc par le NAVIGATEUR de l'acheteuse. Elle peut donc diverger
 * du nombre réel de commandes : une cliente qui rouvre une ancienne
 * confirmation est comptée, une qui vide son stockage local ne l'est pas.
 * C'est pourquoi `ordersRecorded` expose le compte réel à côté — un écart
 * important signale un problème de mesure, pas une baisse de ventes.
 *
 * ⚠️ Les étapes ne sont PAS strictement emboîtées : on ne vérifie pas qu'une
 * même visiteuse a franchi les étapes dans l'ordre. Un taux supérieur à 100 %
 * entre deux étapes est donc possible (rare) et signifie que des visiteuses
 * sont entrées directement en cours de tunnel — par un lien de panier
 * abandonné, par exemple.
 */
export async function getFunnel(
  fromISO: string,
  toISO: string,
): Promise<FunnelResult> {
  if (!hasSupabase()) return emptyFunnel;
  const sb = supabaseAdmin();
  const from = new Date(fromISO);
  const to = new Date(toISO);

  const { data } = await sb
    .from(VISITS)
    .select("path,type,visitor")
    .gte("ts", from.toISOString())
    .lte("ts", to.toISOString())
    .limit(50000);
  const rows = data ?? [];

  /** Visiteurs distincts vérifiant un critère. */
  const uniques = (
    predicate: (r: { path: string | null; type: string | null }) => boolean,
  ) =>
    new Set(
      rows
        .filter((r) => predicate(r as { path: string | null; type: string | null }))
        .map((r) => r.visitor)
        .filter(Boolean),
    ).size;

  const isView = (t: string | null) => t === "view";

  const sessions = uniques((r) => isView(r.type));
  // `/products/<slug>` — la page de collection `/products` n'en fait pas partie.
  const product = uniques(
    (r) => isView(r.type) && !!r.path && /^\/products\/[^/]+/.test(r.path),
  );
  const cart = uniques((r) => r.type === "cart_add");
  const checkout = uniques(
    (r) => isView(r.type) && !!r.path && r.path.startsWith("/checkout"),
  );
  const purchase = uniques(
    (r) => isView(r.type) && !!r.path && /^\/order\/[^/]+/.test(r.path),
  );

  const brut: { key: FunnelStep["key"]; label: string; visitors: number }[] = [
    { key: "sessions", label: "Sessions", visitors: sessions },
    { key: "product", label: "Fiche produit vue", visitors: product },
    { key: "cart", label: "Ajout au panier", visitors: cart },
    { key: "checkout", label: "Paiement atteint", visitors: checkout },
    { key: "purchase", label: "Commande passée", visitors: purchase },
  ];

  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

  const steps: FunnelStep[] = brut.map((s, i) => ({
    ...s,
    shareOfSessions: pct(s.visitors, sessions),
    shareOfPrevious: i === 0 ? 100 : pct(s.visitors, brut[i - 1].visitors),
  }));

  const allOrders = await listOrders();
  const orders = allOrders.filter((o) => {
    const t = new Date(o.date).getTime();
    return t >= from.getTime() && t <= to.getTime() && o.status !== "refunded";
  });
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  return {
    steps,
    conversionRate: pct(purchase, sessions),
    ordersRecorded: orders.length,
    averageOrderValue: orders.length ? Math.round(revenue / orders.length) : 0,
  };
}

/* ─────────── Palmarès produits ─────────── */

export interface LigneProduit {
  slug: string;
  nom: string;
  /** Ajouts au panier, tous visiteurs confondus. */
  ajouts: number;
  /** Personnes distinctes ayant ajouté ce modèle. */
  personnes: number;
  /** Unités vendues (commandes ni annulées ni remboursées). */
  vendus: number;
  /** Chiffre d'affaires du modèle, en centimes. */
  ca: number;
}

/**
 * Palmarès des modèles sur une période.
 *
 * ⚠️ Les ajouts au panier viennent des événements `cart_add`, dont le champ
 * `path` porte le SLUG du produit (cf. `fireCartAdd` dans `lib/cart/store.ts`)
 * — pas un chemin d'URL. Ne pas y appliquer les filtres prévus pour les vues.
 *
 * ⚠️ Les ventes viennent des commandes, pas des événements : un pixel peut
 * être bloqué, une commande non. Les commandes annulées et remboursées sont
 * exclues — encaisser puis rembourser n'est pas une vente.
 */
export async function getTopProduits(
  fromISO: string,
  toISO: string,
): Promise<LigneProduit[]> {
  const noms = new Map<string, string>();
  for (const p of await listProducts()) noms.set(p.slug, p.name);

  const par = new Map<string, LigneProduit>();
  const ligne = (slug: string): LigneProduit => {
    let l = par.get(slug);
    if (!l) {
      l = { slug, nom: noms.get(slug) ?? slug, ajouts: 0, personnes: 0, vendus: 0, ca: 0 };
      par.set(slug, l);
    }
    return l;
  };

  // ── Ajouts au panier ──
  if (hasSupabase()) {
    const { data } = await supabaseAdmin()
      .from(VISITS)
      .select("path,visitor")
      .eq("type", "cart_add")
      .gte("ts", new Date(fromISO).toISOString())
      .lte("ts", new Date(toISO).toISOString())
      .limit(50000);
    const visiteurs = new Map<string, Set<string>>();
    for (const r of data ?? []) {
      const slug = r.path as string | null;
      if (!slug) continue;
      ligne(slug).ajouts += 1;
      if (!visiteurs.has(slug)) visiteurs.set(slug, new Set());
      if (r.visitor) visiteurs.get(slug)!.add(r.visitor as string);
    }
    for (const [slug, set] of visiteurs) ligne(slug).personnes = set.size;
  }

  // ── Ventes ──
  const debut = new Date(fromISO).getTime();
  const fin = new Date(toISO).getTime();
  for (const o of await listOrders()) {
    if (o.status === "cancelled" || o.status === "refunded") continue;
    const t = new Date(o.date).getTime();
    if (Number.isFinite(t) && (t < debut || t > fin)) continue;
    for (const it of o.items) {
      const l = ligne(it.slug);
      l.vendus += it.qty;
      l.ca += it.unitPrice * it.qty;
    }
  }

  return [...par.values()];
}
