/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  MOTEUR D'OFFRES — fonctions pures, aucun accès base ni réseau       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Une SEULE entité couvre les deux besoins du gérant :
 *   • sans `code` → l'offre s'applique toute seule (ex. « 2 achetés, le 3ᵉ offert ») ;
 *   • avec `code` → elle exige que le client saisisse ce code au paiement.
 *
 * Règles arbitrées avec le gérant :
 *   • une seule offre AUTOMATIQUE s'applique — la plus avantageuse pour le client ;
 *   • un code promo se CUMULE par-dessus, et se calcule sur le total déjà remisé.
 *
 * Ce fichier est volontairement pur : il est appelé côté serveur pour arrêter le
 * montant à débiter (`lib/payments/cart.ts`) et côté client pour afficher la
 * remise. Le serveur reste seul juge — l'affichage n'est qu'un confort.
 */

export type PromoKind = "bogo" | "percent" | "amount";
export type PromoScope = "all" | "collection" | "products";

export interface Promotion {
  id: string;
  /** Libellé montré au client (« 2 achetés, le 3ᵉ offert »). */
  name: string;
  enabled: boolean;
  /** Vide = offre automatique. Renseigné = code à saisir au paiement. */
  code?: string;
  kind: PromoKind;

  /* ── Ciblage ── */
  scope: PromoScope;
  /** Catégorie visée quand `scope = "collection"`. */
  collection?: string;
  /** Produits visés quand `scope = "products"`. */
  slugs?: string[];

  /* ── « X achetés, Y offerts » (kind = "bogo") ── */
  buyQty?: number;
  getQty?: number;
  /** Remise sur les articles offerts : 100 = gratuit, 50 = moitié prix. */
  getPercent?: number;

  /* ── Remise simple ── */
  /** kind = "percent" : pourcentage de remise. */
  percent?: number;
  /** kind = "amount" : remise fixe, en CENTIMES. */
  amount?: number;

  /* ── Conditions ── */
  /** Panier minimum en CENTIMES (sur les articles ciblés). */
  minSubtotal?: number;
  /** Dates ISO (yyyy-mm-dd). Bornes incluses. */
  startsAt?: string;
  endsAt?: string;
  /** Nombre maximum d'utilisations, toutes commandes confondues. */
  usageLimit?: number;
  usageCount?: number;
}

/** Ligne de panier enrichie de sa catégorie, pour le ciblage. */
export interface PromoLine {
  slug: string;
  name: string;
  collection: string;
  unitPrice: number;
  qty: number;
}

export interface AppliedDiscount {
  promoId: string;
  /** Libellé affiché au client et enregistré sur la commande. */
  label: string;
  /** Montant de la remise, en CENTIMES (toujours positif). */
  amount: number;
  /** Code saisi, s'il s'agit d'une offre à code. */
  code?: string;
}

export interface CartTotals {
  /** Somme des articles, avant remise. */
  subtotal: number;
  /** Offre automatique retenue (la plus avantageuse), si elle existe. */
  auto?: AppliedDiscount;
  /** Remise liée au code saisi. */
  promoCode?: AppliedDiscount;
  /** Raison du refus du code saisi, à afficher au client. */
  codeError?: string;
  /** Total à payer, remises déduites. Jamais négatif. */
  total: number;
}

/* ────────────────────────── Validité ────────────────────────── */

const asDate = (v?: string) => (v ? new Date(`${v}T00:00:00`) : null);

/** Une offre est-elle utilisable aujourd'hui ? (hors condition de panier) */
export function isLive(promo: Promotion, now = new Date()): boolean {
  if (!promo.enabled) return false;
  const start = asDate(promo.startsAt);
  const end = asDate(promo.endsAt);
  if (start && now < start) return false;
  // Bornes incluses : une offre qui finit le 5 court jusqu'au 5 à 23 h 59.
  if (end && now > new Date(end.getTime() + 24 * 3600 * 1000 - 1)) return false;
  if (promo.usageLimit && (promo.usageCount ?? 0) >= promo.usageLimit) return false;
  return true;
}

/** Lignes concernées par le ciblage de l'offre. */
function targeted(promo: Promotion, lines: PromoLine[]): PromoLine[] {
  if (promo.scope === "collection") {
    return lines.filter((l) => l.collection === promo.collection);
  }
  if (promo.scope === "products") {
    const set = new Set(promo.slugs ?? []);
    return lines.filter((l) => set.has(l.slug));
  }
  return lines;
}

const sum = (lines: PromoLine[]) =>
  lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);

/* ────────────────────────── Calcul ────────────────────────── */

/**
 * Montant remisé par une offre sur un panier, en centimes. 0 = non applicable.
 *
 * @param base Total sur lequel s'applique une remise en pourcentage. Sert au
 *             cumul : un code « -10 % » porte sur le total déjà réduit par
 *             l'offre automatique, jamais sur le prix plein.
 */
export function discountOf(
  promo: Promotion,
  lines: PromoLine[],
  base?: number,
): number {
  const scope = targeted(promo, lines);
  if (scope.length === 0) return 0;

  const scopeTotal = sum(scope);
  if (promo.minSubtotal && scopeTotal < promo.minSubtotal) return 0;

  if (promo.kind === "bogo") {
    const buy = Math.max(1, promo.buyQty ?? 1);
    const get = Math.max(1, promo.getQty ?? 1);
    const off = Math.min(100, Math.max(1, promo.getPercent ?? 100));

    // On déplie les articles à l'unité : « 2 achetés + 1 offert » raisonne en
    // articles, pas en lignes de panier.
    const units: number[] = [];
    for (const l of scope) for (let i = 0; i < l.qty; i++) units.push(l.unitPrice);

    const groups = Math.floor(units.length / (buy + get));
    if (groups === 0) return 0;

    // Ce sont les articles les MOINS chers qui sont offerts — l'usage du
    // commerce, et la seule lecture qui ne fasse pas perdre d'argent au gérant.
    units.sort((a, b) => a - b);
    return units
      .slice(0, groups * get)
      .reduce((n, price) => n + Math.round((price * off) / 100), 0);
  }

  if (promo.kind === "percent") {
    const pct = Math.min(100, Math.max(0, promo.percent ?? 0));
    const on = base !== undefined ? Math.min(base, scopeTotal) : scopeTotal;
    return Math.round((on * pct) / 100);
  }

  // Remise fixe : jamais plus que ce que vaut le panier ciblé.
  const fixed = Math.max(0, promo.amount ?? 0);
  return Math.min(fixed, base !== undefined ? Math.min(base, scopeTotal) : scopeTotal);
}

const normalise = (code: string) => code.trim().toUpperCase();

/**
 * Applique les offres à un panier.
 *
 * @param code Code saisi par le client au paiement (facultatif).
 */
export function applyPromotions(
  lines: PromoLine[],
  promotions: Promotion[],
  code?: string,
  now = new Date(),
): CartTotals {
  const subtotal = sum(lines);
  const live = promotions.filter((p) => isLive(p, now));

  // ── 1. Meilleure offre automatique (sans code) ──
  let auto: AppliedDiscount | undefined;
  for (const promo of live.filter((p) => !p.code?.trim())) {
    const amount = discountOf(promo, lines);
    if (amount > 0 && amount > (auto?.amount ?? 0)) {
      auto = { promoId: promo.id, label: promo.name, amount };
    }
  }

  // ── 2. Code promo, cumulé par-dessus ──
  let promoCode: AppliedDiscount | undefined;
  let codeError: string | undefined;
  const typed = code?.trim();
  if (typed) {
    const wanted = normalise(typed);
    const promo = promotions.find(
      (p) => p.code?.trim() && normalise(p.code) === wanted,
    );
    if (!promo) {
      codeError = "Ce code promo n'existe pas.";
    } else if (!isLive(promo, now)) {
      codeError = "Ce code promo n'est plus valable.";
    } else {
      // Le code porte sur ce qu'il reste à payer après l'offre automatique.
      const amount = discountOf(promo, lines, subtotal - (auto?.amount ?? 0));
      if (amount <= 0) {
        codeError = promo.minSubtotal
          ? "Votre panier n'atteint pas le minimum requis pour ce code."
          : "Ce code ne s'applique à aucun article de votre panier.";
      } else {
        promoCode = {
          promoId: promo.id,
          label: promo.name,
          amount,
          code: normalise(promo.code!),
        };
      }
    }
  }

  const total = Math.max(
    0,
    subtotal - (auto?.amount ?? 0) - (promoCode?.amount ?? 0),
  );
  return { subtotal, auto, promoCode, codeError, total };
}

/** Résumé lisible d'une offre, pour le back-office. */
export function describe(promo: Promotion): string {
  const cible =
    promo.scope === "all"
      ? "tout le catalogue"
      : promo.scope === "collection"
      ? `la catégorie « ${promo.collection ?? "?"} »`
      : `${promo.slugs?.length ?? 0} produit(s)`;

  if (promo.kind === "bogo") {
    const get = promo.getPercent === 100 ? "offert(s)" : `à −${promo.getPercent} %`;
    return `${promo.buyQty} acheté(s), ${promo.getQty} ${get} — sur ${cible}`;
  }
  if (promo.kind === "percent") return `−${promo.percent} % sur ${cible}`;
  return `−${((promo.amount ?? 0) / 100).toFixed(2)} € sur ${cible}`;
}
