import { brand } from "@/config/brand.config";
import type { Product } from "@/lib/products";
import type { Review } from "@/lib/reviews";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  DONNÉES STRUCTURÉES (JSON-LD)                                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Ce que Google ne devine pas tout seul : qu'une page est un PRODUIT, à quel
 * prix, disponible ou non. Sans ce balisage, la fiche reste un texte parmi
 * d'autres ; avec lui, elle peut afficher le prix et la disponibilité dans les
 * résultats et entrer dans l'onglet Shopping gratuit.
 *
 * ⚠️ LE BALISAGE DOIT DÉCRIRE LA PAGE, JAMAIS L'EMBELLIR. Un prix, une
 * disponibilité ou une note qui ne correspondent pas à ce qui est affiché
 * valent une action manuelle de Google (perte des résultats enrichis), et
 * relèvent en France de la pratique commerciale trompeuse. Toutes les valeurs
 * ci-dessous sont donc DÉRIVÉES du catalogue et des avis réels — aucune n'est
 * écrite à la main.
 *
 * ⚠️ MATIÈRE : `material` vient du produit. Bari, Concorde et Pigalle sont en
 * PVC ; ne jamais forcer « cuir » ici (cf. HANDOFF §2, décret 2010-29).
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

/** URL absolue — Google refuse les chemins relatifs dans le JSON-LD. */
export const absolu = (chemin: string) =>
  chemin.startsWith("http") ? chemin : `${SITE}${chemin}`;

/**
 * Sérialise en neutralisant `<`.
 *
 * ⚠️ Sans ça, une description contenant « </script> » fermerait la balise et
 * le reste s'exécuterait comme du HTML. Le contenu vient du back-office, donc
 * d'une saisie humaine : on ne fait pas confiance à sa forme.
 */
export const jsonLd = (donnees: object) =>
  JSON.stringify(donnees).replace(/</g, "\\u003c");

/* ─────────────────────────── Socle ─────────────────────────── */

/** La maison elle-même. Posée une fois, sur l'accueil. */
export function organisationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: SITE,
    logo: absolu("/icon.svg"),
    description: brand.description,
    email: brand.contact.email,
    ...(brand.social?.length
      ? { sameAs: brand.social.map((s) => s.href).filter((h) => /^https?:/.test(h)) }
      : {}),
  };
}

/** Le site, pour que Google rattache le nom de marque au domaine. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: SITE,
    inLanguage: brand.locale,
  };
}

/**
 * Fil d'Ariane. Affiché tel quel sous le titre dans les résultats, à la place
 * de l'URL brute — c'est ce qui remplace « exemple.com › products ».
 */
export function filArianeJsonLd(etapes: { nom: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: etapes.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.nom,
      item: absolu(e.url),
    })),
  };
}

/* ─────────────────────────── Produit ─────────────────────────── */

/** Stock total, toutes variantes confondues. */
const stockTotal = (p: Product) =>
  p.variants.reduce((n, v) => n + v.stock, 0);

/**
 * Disponibilité réelle.
 *
 * ⚠️ `manageStock` absent = stock non suivi, donc disponible : c'est le cas
 * de la quasi-totalité du catalogue. N'annoncer « en stock » que sur la foi
 * d'un compteur qui n'est pas tenu serait faux dans l'autre sens.
 */
function disponibilite(p: Product): string {
  if (p.manageStock && stockTotal(p) <= 0) return "https://schema.org/OutOfStock";
  return "https://schema.org/InStock";
}

/**
 * Fiche produit balisée.
 *
 * `avisPropres` ne doit contenir QUE les avis qui citent ce modèle. Appliquer
 * la note moyenne du site à un produit qui n'a reçu aucun avis est précisément
 * ce que Google sanctionne, et ce serait mentir à la cliente.
 */
export function produitJsonLd(p: Product, avisPropres: Review[] = []) {
  const url = absolu(`/products/${p.slug}`);
  const note =
    avisPropres.length > 0
      ? avisPropres.reduce((t, r) => t + r.rating, 0) / avisPropres.length
      : null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.images.map((i) => absolu(i)),
    sku: p.slug,
    category: p.collection,
    material: p.material,
    brand: { "@type": "Brand", name: brand.name },
    offers: {
      "@type": "Offer",
      url,
      // Schema.org veut une chaîne décimale en unités majeures : 129.00.
      price: (p.price / 100).toFixed(2),
      priceCurrency: brand.currency,
      availability: disponibilite(p),
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: brand.name },
    },
    ...(note !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: note.toFixed(1),
            reviewCount: avisPropres.length,
            bestRating: "5",
          },
          review: avisPropres.map((r) => ({
            "@type": "Review",
            reviewRating: {
              "@type": "Rating",
              ratingValue: String(r.rating),
              bestRating: "5",
            },
            author: { "@type": "Person", name: r.author },
            name: r.title,
            reviewBody: r.body,
          })),
        }
      : {}),
  };
}

/** Page collection : la liste des modèles, dans l'ordre affiché. */
export function collectionJsonLd(produits: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `La collection ${brand.name}`,
    url: absolu("/products"),
    inLanguage: brand.locale,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: produits.length,
      itemListElement: produits.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absolu(`/products/${p.slug}`),
        name: p.name,
      })),
    },
  };
}

/* ─────────────────────── Descriptions méta ─────────────────────── */

/**
 * Coupe à la frontière d'un mot, sans jamais tronquer au milieu.
 * Google affiche environ 155 caractères ; au-delà il coupe lui-même, et
 * toujours plus mal.
 */
export function couperMeta(texte: string, maxi = 158): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= maxi) return propre;
  const bout = propre.slice(0, maxi - 1);
  return bout.slice(0, bout.lastIndexOf(" ")).replace(/[,;:—-]$/, "") + "…";
}

/**
 * Description d'une fiche produit.
 *
 * Le `tagline` seul faisait 25 caractères — une ligne blanche dans les
 * résultats. On compose matière, format et promesse de livraison, toutes
 * tirées du catalogue et de `brand`, donc vraies par construction.
 */
export function descriptionProduit(p: Product): string {
  return couperMeta(
    /* ⚠️ PAS de `.toLowerCase()` sur `detail` : il écrasait les unités et les
       sigles — « 12 W LED » sortait en « 12 w led », « 260 mmHg » en
       « 260 mmhg ». Le champ est saisi par le gérant, sa casse est voulue. */
    `${p.tagline}. ${p.material}, ${p.detail}. ` + `${brand.shippingDetail}.`,
  );
}

/* ─────────────────── Titre de résultat de recherche ─────────────────── */

/** Type de sac cherché, par ligne. Sert à composer le titre. */
const TYPE_PAR_LIGNE: Record<string, string> = {
  Cabas: "Cabas",
  Seau: "Sac seau",
  "Épaule": "Sac porté épaule",
  "Porté main": "Sac à main",
  "Petits formats": "Petit sac",
};

/**
 * Titre de l'onglet et du résultat Google.
 *
 * ⚠️ NE CHANGE RIEN À LA PAGE. Le nom du modèle reste affiché tel quel dans
 * le `<h1>` : c'est la marque, et le gérant y tient. Ici on ne compose que la
 * balise `<title>`, qui doit mener par le terme RÉELLEMENT cherché.
 * « Concorde — La transparence, en jaune » ne correspond à aucune recherche ;
 * « Sac à main jaune en PVC translucide — Concorde » en couvre plusieurs.
 *
 * Le nom du modèle reste présent, en fin de titre : il sert aux clientes qui
 * reviennent en cherchant la pièce par son nom.
 */
export function titreProduit(p: Product): string {
  /* ⚠️ Repli NEUTRE. Le modèle retombait sur « Sac », reste de la boutique
     de maroquinerie dont il est extrait : toute boutique dont la collection
     n'est pas déclarée ci-dessus titrait donc ses fiches « Sac … ». */
  const type = TYPE_PAR_LIGNE[p.collection] ?? p.tagline;
  const couleur = p.variants[0]?.label?.toLowerCase() ?? "";
  const matiere = matiereCourte(p.material);
  const socle = [type, couleur, matiere && `en ${matiere}`]
    .filter(Boolean)
    .join(" ");
  // 60 caractères environ : au-delà, Google tronque et le nom disparaît.
  return couperMeta(`${socle} — ${p.name}`, 60);
}

/** « Cuir grainé · fermoir doré » → « cuir grainé ». Sigles conservés. */
function matiereCourte(material: string): string {
  const mots = material.split("·")[0].trim().split(/\s+/);
  return mots.map((m) => (m.toLowerCase() === "pvc" ? "PVC" : m.toLowerCase())).join(" ");
}
