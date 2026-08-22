import { brand } from "@/config/brand.config";

/**
 * Avis clients affichés sur la vitrine.
 *
 * ⚠️ RECOPIÉS MOT POUR MOT, JAMAIS RETOUCHÉS. Modifier le texte d'un avis —
 * même pour corriger une faute, même pour retirer un mot gênant — est une
 * pratique commerciale trompeuse (art. L121-2 du Code de la consommation) et
 * fait perdre le bénéfice des résultats enrichis chez Google. Un avis se
 * publie ou ne se publie pas ; il ne se réécrit pas.
 *
 * ⚠️ NE JAMAIS EN INVENTER. Deux ans d'emprisonnement, 300 000 € d'amende, et
 * c'est le premier motif de suspension chez Google Merchant Center comme chez
 * les prestataires de paiement.
 *
 * ⚠️ LA MOYENNE SE CALCULE, ELLE NE S'ÉCRIT PAS. `averageRating()` la dérive
 * des avis réellement publiés. Aucun compte d'avis n'est affiché — décision
 * du gérant, expliquée plus bas : une note doit toujours porter sur ce qui
 * est montré, sans quoi Google constate l'écart entre la page et le balisage.
 *
 * Tant que le tableau est vide, les sections qui l'utilisent disparaissent
 * d'elles-mêmes : il n'y a rien à désactiver.
 */
export interface Review {
  /** Note sur 5, telle que laissée par le client. */
  rating: number;
  title: string;
  body: string;
  author: string;
  /** Date de dépôt (ISO). Balisée en `datePublished` : un avis sans date est
   *  moins crédible, et Google la réclame pour les résultats enrichis. */
  date: string;
  /** Produit concerné. Sert à afficher l'avis sur la fiche correspondante. */
  slug?: string;
  /**
   * ⚠️ L'avis emploie un vocabulaire de SOIN (drainage, rétention d'eau,
   * circulation sanguine…). Voir `PUBLIER_REGISTRE_SANTE` ci-dessous.
   */
  registreSante?: true;
}

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AVIS EMPLOYANT UN VOCABULAIRE DE SOIN — DÉCISION DU GÉRANT      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Deux clients décrivent spontanément leur expérience en termes de drainage,
 * de rétention d'eau et de circulation sanguine. Ce sont LEURS mots : ils sont
 * conservés tels quels ci-dessous, et il est hors de question de les corriger.
 *
 * ⚠️ MAIS LE CHOIX DE LES METTRE EN AVANT APPARTIENT AU VENDEUR, et c'est ce
 * choix qui est opposable. Un appareil de confort non marqué CE dispositif
 * médical ne peut pas se prévaloir d'une action sur la circulation, fût-ce par
 * la bouche d'un client sélectionné pour ça. La DGCCRF comme la politique
 * « santé » de Google Ads regardent la page entière, pas l'auteur de la phrase.
 *
 * `false` = ces avis restent dans le fichier mais ne s'affichent pas.
 * Passer à `true` est une décision assumée par le gérant, pas un réglage.
 */
const PUBLIER_REGISTRE_SANTE = false;

/**
 * Avis reçus, dans l'ordre transmis par le gérant.
 * ⚠️ Ajouter les nouveaux ICI, verbatim, avec leur date réelle.
 */
const AVIS: Review[] = [
  // ⚠️ VIDE : à remplir avec les avis RÉELLEMENT reçus, verbatim, avec leur
  // date. Tant que ce tableau est vide, les sections d'avis disparaissent
  // d'elles-mêmes — il n'y a rien à désactiver.
];

/** Avis effectivement publiés, du plus récent au plus ancien. */
export const reviews: Review[] = AVIS.filter(
  (a) => PUBLIER_REGISTRE_SANTE || !a.registreSante,
).sort((a, b) => b.date.localeCompare(a.date));

/*
 * ⚠️ PAS DE COMPTE D'AVIS AFFICHÉ — CHOIX DU GÉRANT, À NE PAS « RÉPARER ».
 *
 * L'export `NOMBRE_AVIS` a été supprimé. Il portait auparavant un total
 * annoncé (362) sans rapport avec les avis publiés : la note se calculait sur
 * une poignée d'avis, le compte en annonçait des centaines, et le balisage
 * JSON-LD déclarait un troisième chiffre. Trois valeurs pour une même
 * information, c'est l'incohérence que contrôlent Merchant Center et la
 * DGCCRF.
 *
 * Plutôt qu'un compte honnête mais modeste, le gérant préfère n'en afficher
 * aucun. La note reste dérivée des avis réellement publiés, et `reviewCount`
 * dans le JSON-LD reste égal au nombre d'avis effectivement montrés — les
 * deux sources ne peuvent donc plus diverger.
 *
 * Si un compte doit réapparaître un jour, il se DÉRIVE de `reviews.length`.
 * Jamais une valeur saisie à la main.
 */

/**
 * Mention de transparence — art. L111-7-2 du Code de la consommation.
 *
 * ⚠️ OBLIGATOIRE dès lors qu'on affiche des avis. La loi impose de dire si
 * leur authenticité est vérifiée ET comment ; l'omission est sanctionnée au
 * même titre qu'un avis inventé.
 *
 * ⚠️ CETTE PHRASE EST OPPOSABLE : elle doit décrire la réalité de CETTE
 * boutique, et être corrigée en même temps qu'elle. Sur une boutique
 * précédente, elle a successivement annoncé des clients « ayant commandé sur
 * le site » alors qu'aucune commande n'y avait jamais été passée, puis des
 * acheteurs « servis en main propre » alors que les avis suivants
 * mentionnaient tous une livraison. Une mention inexacte est PIRE que pas de
 * mention : elle affirme une vérification qui n'existe pas.
 *
 * ⚠️ NE NOMMER UN CANAL DE VENTE QUE S'IL EST CERTAIN. Si les avis viennent
 * d'une boutique antérieure, d'une autre enseigne ou d'une marketplace, le
 * dire ici : une provenance nommée et exacte vaut mieux qu'un silence, et
 * c'est ce que contrôle la DGCCRF.
 */
export const MENTION_AVIS =
  "Avis de clients ayant acheté et utilisé nos produits, recueillis " +
  `directement par ${brand.name}. Ils sont reproduits sans modification et ` +
  "publiés sans contrepartie. Il s'agit d'une sélection, et leur " +
  "authenticité n'est pas vérifiée par un organisme tiers indépendant.";

/**
 * Date d'avis en toutes lettres, pour l'affichage.
 *
 * ⚠️ Découpage de la chaîne ISO, SANS passer par `new Date()` : construire un
 * objet Date à partir de « 2026-08-15 » le place à minuit UTC, et un serveur
 * à l'ouest de Greenwich afficherait alors la veille. `Intl` est écarté pour
 * la même raison — le fuseau du serveur de rendu n'est pas celui du lecteur.
 */
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function dateAvis(iso: string): string {
  const [a, m, j] = iso.split("-");
  const mois = MOIS[Number(m) - 1];
  if (!mois) return "";
  return `${Number(j)} ${mois} ${a}`;
}

/** Moyenne réelle des avis publiés, arrondie au dixième. `0` si aucun. */
export function averageRating(): number {
  if (reviews.length === 0) return 0;
  const somme = reviews.reduce((t, r) => t + r.rating, 0);
  return Math.round((somme / reviews.length) * 10) / 10;
}
