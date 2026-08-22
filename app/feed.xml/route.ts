import { listVisibleProducts } from "@/lib/actions/products";
import { brand } from "@/config/brand.config";
import type { Product } from "@/lib/products";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  FLUX PRODUIT GOOGLE MERCHANT CENTER                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Sert le catalogue au format RSS 2.0 + espace de noms `g:`, le seul que
 * Merchant Center sait lire sans tableur.
 *
 * ⚠️ POURQUOI UN FLUX PLUTÔT QUE L'EXPLORATION AUTOMATIQUE. Merchant Center
 * peut deviner les articles en lisant les pages, mais il devine aussi le prix,
 * la disponibilité et le titre — et se trompe. Un écart entre ce qu'il a
 * deviné et ce que la page affiche vaut « Mismatch of price », c'est-à-dire
 * la désapprobation de l'article, puis du compte s'il se répète. Le flux
 * supprime la devinette : il DÉCLARE.
 *
 * ⚠️ TOUTES LES VALEURS SONT DÉRIVÉES DU CATALOGUE. Ne jamais écrire ici un
 * prix, un stock ou un titre en dur : le flux et la page produit seraient
 * alimentés par deux sources, elles divergeraient au premier changement fait
 * depuis le back-office, et c'est exactement la divergence que Google
 * sanctionne.
 *
 * BRANCHEMENT : Merchant Center → Produits → Sources → « Ajouter des produits
 * depuis un fichier » → URL planifiée → https://<votre-domaine>/feed.xml
 *
 * ⚠️ `force-dynamic` : un flux mis en cache annoncerait un stock périmé.
 */
export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

/**
 * Catégorie de la taxonomie Google.
 *
 * `543596` = Santé et beauté > Hygiène personnelle > Massage et relaxation >
 * Accessoires de massage > Appareils de massage électriques.
 *
 * ⚠️ VÉRIFIÉ DANS LA TAXONOMIE OFFICIELLE, et il faut le refaire avant tout
 * changement : taxonomy-with-ids.fr-FR.txt sur google.com/basepages/producttype.
 * L'identifiant 536, souvent conseillé pour ce produit, désigne en réalité
 * « Maison et jardin » — il rangerait l'appareil au rayon jardinage et le
 * ferait concourir contre des tondeuses.
 *
 * ⚠️ LE CHOIX DE LA CATÉGORIE EST AUSSI UN CHOIX RÉGLEMENTAIRE. Celle-ci
 * relève du massage et de la relaxation, pas du matériel médical : c'est
 * cohérent avec le registre bien-être tenu sur tout le site. Basculer vers une
 * catégorie de soin ferait appliquer à l'article la politique « santé » de
 * Google, qui exige un marquage CE dispositif médical que nous n'avons pas.
 */
const CATEGORIE_GOOGLE = "543596";

/**
 * Étiquette de segmentation des campagnes (`custom_label_0`).
 *
 * ⚠️ USAGE STRICTEMENT INTERNE : jamais affichée à l'internaute. Elle sert à
 * dire à Performance Max quels articles pousser en priorité. Ce n'est donc PAS
 * une allégation commerciale — « bestseller » ici n'affirme rien au public.
 *
 * Un produit peut la surcharger via `etiquetteAds` dans le catalogue.
 */
const ETIQUETTE_PAR_DEFAUT = "produit-phare";

/** Échappement XML. Une esperluette nue suffit à rendre le flux illisible. */
function xml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const absolu = (c: string) => (c.startsWith("http") ? c : `${SITE}${c}`);

/**
 * Référence fabricant — MÊME dérivation que `lib/seo.ts`.
 *
 * ⚠️ Le `mpn` du flux et celui du balisage JSON-LD de la page doivent être
 * IDENTIQUES : Google rapproche les deux, et deux références différentes pour
 * une même URL font douter de l'identité de l'article.
 */
function referenceFabricant(p: Product): string {
  return p.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
}

/** Stock réel, quand il est suivi. Sinon disponible. */
function disponibilite(p: Product): string {
  if (!p.manageStock) return "in_stock";
  const total = p.variants.reduce((t, v) => t + (v.stock || 0), 0);
  return total > 0 ? "in_stock" : "out_of_stock";
}

/**
 * Titre du flux.
 *
 * ⚠️ 150 caractères maximum, et il doit RESSEMBLER au titre de la page : un
 * titre de flux enrichi de mots-clés absents de la page est traité comme du
 * bourrage et fait désapprouver l'article.
 */
function titre(p: Product): string {
  const t = `${p.name} — ${p.tagline}`;
  return t.length <= 150 ? t : t.slice(0, 147).trimEnd() + "…";
}

function article(p: Product): string {
  const url = absolu(`/products/${p.slug}`);
  const images = p.images.map(absolu);
  const [principale, ...autres] = images;

  const champs: string[] = [
    `<g:id>${xml(p.slug)}</g:id>`,
    `<g:title>${xml(titre(p))}</g:title>`,
    `<g:description>${xml(p.description)}</g:description>`,
    `<g:link>${xml(url)}</g:link>`,
    `<g:image_link>${xml(principale)}</g:image_link>`,
    // 10 images additionnelles au maximum, au-delà Google ignore le flux.
    ...autres.slice(0, 10).map((i) => `<g:additional_image_link>${xml(i)}</g:additional_image_link>`),
    `<g:availability>${disponibilite(p)}</g:availability>`,
    // Prix en unités majeures, devise ISO. La société n'étant pas assujettie
    // à la TVA, le prix affiché EST le prix final — cf. `brand.legal.vatNotice`.
    `<g:price>${(p.price / 100).toFixed(2)} ${brand.currency}</g:price>`,
    `<g:condition>new</g:condition>`,
    `<g:brand>${xml(brand.name)}</g:brand>`,
    // `mpn` + `brand` tiennent lieu d'identifiant unique tant qu'aucun
    // code-barres n'est attribué. Ne PAS ajouter `identifier_exists: no` :
    // ce serait faux, et cela priverait l'article de la comparaison de prix.
    `<g:mpn>${xml(referenceFabricant(p))}</g:mpn>`,
    ...(p.gtin ? [`<g:gtin>${xml(p.gtin)}</g:gtin>`] : []),
    `<g:product_type>${xml(p.collection)}</g:product_type>`,
    // Catégorie Google : renseignée plutôt que devinée. Laissée à
    // l'appréciation de Google, elle change sans prévenir, et un article
    // reclassé perd d'un jour à l'autre les enchères sur lesquelles il tournait.
    `<g:google_product_category>${CATEGORIE_GOOGLE}</g:google_product_category>`,
    `<g:custom_label_0>${xml(p.etiquetteAds || ETIQUETTE_PAR_DEFAUT)}</g:custom_label_0>`,
    // ⚠️ Zone de livraison : France métropolitaine SEULE. Le tunnel de
    // commande force `country: "FR"` ; élargir ici ferait diffuser des
    // annonces sur des commandes que nous refuserions ensuite.
    `<g:shipping><g:country>FR</g:country><g:service>Colissimo</g:service><g:price>0.00 ${brand.currency}</g:price></g:shipping>`,
    // Délais opposables, identiques aux CGV (art. L216-2).
    `<g:min_handling_time>0</g:min_handling_time>`,
    `<g:max_handling_time>2</g:max_handling_time>`,
    `<g:min_transit_time>3</g:min_transit_time>`,
    `<g:max_transit_time>5</g:max_transit_time>`,
  ];

  return `<item>${champs.join("")}</item>`;
}

export async function GET() {
  const produits = await listVisibleProducts();

  const corps =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">` +
    `<channel>` +
    `<title>${xml(brand.name)}</title>` +
    `<link>${xml(SITE)}</link>` +
    `<description>${xml(brand.description)}</description>` +
    produits.map(article).join("") +
    `</channel></rss>`;

  return new Response(corps, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600",
    },
  });
}
