import "server-only";
import type { CheckoutDraft } from "@/lib/actions/checkout";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  IDENTITÉ TRANSMISE AUX PROCESSEURS DE PAIEMENT                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Nom, téléphone et adresse de livraison, mis en forme pour chaque PSP.
 *
 * POURQUOI. Un paiement qui n'arrive chez le PSP qu'avec un montant et un
 * e-mail est aveugle des deux côtés :
 *
 *  1. **Anti-fraude** — l'écart entre l'adresse de facturation de la carte et
 *     l'adresse de livraison est l'un des signaux les plus discriminants.
 *     Sans adresse, ce contrôle n'existe pas : des cartes volées passent, et
 *     ce sont NOS impayés.
 *  2. **Litiges** — les preuves qui font gagner une contestation « colis non
 *     reçu » sont le nom du destinataire, l'adresse, le transporteur et le
 *     numéro de suivi. Transmises à l'avance, elles sont déjà dans le dossier
 *     le jour où la contestation tombe (délai de réponse : 7 jours).
 *  3. **Tenue de compte** — un marchand dont les transactions n'ont ni nom,
 *     ni adresse, ni référence de commande ressemble, dans les outils de
 *     risque, à une passerelle qui encaisse pour un tiers. C'est le profil
 *     qui déclenche une revue, une réserve, ou un gel.
 *
 * ⚠️ CES DONNÉES SONT INFORMATIVES, JAMAIS COMPTABLES. Elles viennent du
 * navigateur. Le montant débité, lui, continue d'être recalculé depuis le
 * catalogue (`lib/payments/cart.ts`) — une adresse falsifiée ne peut donc
 * rien changer au prix payé.
 *
 * ⚠️ AUCUN APPEL D'IDENTITÉ NE DOIT POUVOIR EMPÊCHER UN PAIEMENT. Chaque
 * intégration ci-dessous est soit incluse dans la requête existante, soit
 * enveloppée d'un repli : si le PSP refuse un champ, la cliente paie quand
 * même. Perdre une vente pour un champ d'anti-fraude serait absurde.
 */

/** Pays par défaut : le formulaire ne demande pas le pays (livraison France). */
const PAYS_DEFAUT = "FR";

export interface Identite {
  prenom: string;
  nom: string;
  nomComplet: string;
  email: string;
  telephone: string;
  rue: string;
  codePostal: string;
  ville: string;
  /** ISO 3166-1 alpha-2. */
  pays: string;
}

/**
 * Retire les accents et la ponctuation exotique.
 *
 * ⚠️ Indispensable, pas cosmétique : plusieurs PSP (Fondy explicitement)
 * n'acceptent que des caractères latins non accentués dans ces champs, et
 * rejettent la requête entière sur un « é ». Or nous sommes une boutique
 * française : « Rue de l'Hôtel-de-Ville », « Chloé » sont la norme.
 */
export function sansAccent(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s'’.,\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise un numéro de téléphone français en format international.
 * « 06 12 34 56 78 » → « +33612345678 ». Un numéro déjà international, ou
 * étranger, est conservé tel quel (espaces retirés).
 */
export function telephoneInternational(saisie: string): string {
  const brut = saisie.replace(/[^\d+]/g, "");
  if (!brut) return "";
  if (brut.startsWith("+")) return brut;
  if (brut.startsWith("00")) return `+${brut.slice(2)}`;
  if (brut.length === 10 && brut.startsWith("0")) return `+33${brut.slice(1)}`;
  return brut;
}

/** Vrai si la saisie ressemble à un numéro exploitable par un livreur. */
export function telephoneValide(saisie: string): boolean {
  const chiffres = saisie.replace(/\D/g, "");
  return chiffres.length >= 9 && chiffres.length <= 15;
}

/**
 * Reconstruit l'identité à partir du brouillon.
 *
 * Les champs structurés (`firstName`, `street`…) sont apparus après la mise en
 * ligne : un brouillon plus ancien, ou un tunnel qui ne les remplirait pas,
 * doit continuer de fonctionner. D'où les replis sur `customer` et `address`.
 */
export function identiteDe(draft: CheckoutDraft): Identite {
  const nomComplet = (draft.customer ?? "").trim();
  const [premier, ...reste] = nomComplet.split(/\s+/);
  const prenom = draft.firstName?.trim() || premier || "";
  const nom = draft.lastName?.trim() || reste.join(" ") || "";
  return {
    prenom,
    nom,
    nomComplet: nomComplet || `${prenom} ${nom}`.trim(),
    email: (draft.email ?? "").trim(),
    telephone: telephoneInternational(draft.phone ?? ""),
    rue: (draft.street ?? draft.address ?? "").trim(),
    codePostal: (draft.zip ?? "").trim(),
    ville: (draft.city ?? "").trim(),
    pays: (draft.country ?? PAYS_DEFAUT).toUpperCase(),
  };
}

/* ───────────────────────────── Stripe ───────────────────────────── */

/**
 * Bloc `shipping` d'un PaymentIntent Stripe. `carrier` et `trackingNumber` sont
 * renseignés plus tard, à l'expédition (cf. `lib/payments/tracking.ts`).
 */
export function stripeShipping(draft: CheckoutDraft) {
  const id = identiteDe(draft);
  if (!id.nomComplet || !id.rue) return undefined;
  return {
    name: id.nomComplet,
    phone: id.telephone || undefined,
    address: {
      line1: id.rue,
      city: id.ville || undefined,
      postal_code: id.codePostal || undefined,
      country: id.pays,
    },
  };
}

/* ──────────────────────────── Airwallex ──────────────────────────── */

/**
 * Bloc `order.shipping` d'un PaymentIntent Airwallex.
 * ⚠️ `address.country_code` est obligatoire dès que `address` est présent.
 */
export function airwallexShipping(draft: CheckoutDraft) {
  const id = identiteDe(draft);
  if (!id.nomComplet) return undefined;
  const shipping: Record<string, unknown> = {
    first_name: id.prenom || undefined,
    last_name: id.nom || id.prenom || undefined,
    phone_number: id.telephone || undefined,
  };
  if (id.rue) {
    shipping.address = {
      street: id.rue,
      city: id.ville || undefined,
      postcode: id.codePostal || undefined,
      country_code: id.pays,
    };
  }
  return shipping;
}

/* ────────────────────────────── Fondy ────────────────────────────── */

/**
 * `reservation_data` de Fondy : JSON encodé en base64, transmis tel quel à
 * leur moteur anti-fraude et aux dossiers de litige.
 *
 * ⚠️ Caractères latins uniquement — d'où `sansAccent()` sur chaque valeur.
 */
export function fondyReservationData(draft: CheckoutDraft): string | undefined {
  const id = identiteDe(draft);
  if (!id.nomComplet && !id.rue) return undefined;
  const data: Record<string, string> = {};
  if (id.nomComplet) data.customer_name = sansAccent(id.nomComplet);
  if (id.rue) data.customer_address = sansAccent(id.rue);
  if (id.ville) data.customer_city = sansAccent(id.ville);
  if (id.codePostal) data.customer_zip = sansAccent(id.codePostal);
  if (id.pays) data.customer_country = id.pays;
  if (id.telephone) data.phonemobile = id.telephone;
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64");
}

/* ────────────────────────────── Genome ───────────────────────────── */

/**
 * Claims `VALUE_*` de la page hébergée Genome.
 * Noms vérifiés sur la documentation marchand (Hosted Payment Page).
 */
export function genomeIdentityClaims(
  draft: CheckoutDraft,
): Record<string, string> {
  const id = identiteDe(draft);
  const claims: Record<string, string> = {};
  if (id.prenom) claims.VALUE_FIRST_NAME = id.prenom;
  if (id.nom) claims.VALUE_LAST_NAME = id.nom;
  if (id.telephone) claims.VALUE_PHONE = id.telephone;
  if (id.rue) claims.VALUE_ADDRESS = id.rue;
  if (id.ville) claims.VALUE_CITY = id.ville;
  if (id.codePostal) claims.VALUE_ZIP = id.codePostal;
  if (id.pays) claims.VALUE_COUNTRY = id.pays;
  return claims;
}
