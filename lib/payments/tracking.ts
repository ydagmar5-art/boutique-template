import "server-only";
import Stripe from "stripe";
import { brand } from "@/config/brand.config";
import { carrierLabel } from "@/lib/carriers";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { airwallexAttachIdentity, airwallexCreds } from "@/lib/payments/airwallex";
import type { Order } from "@/lib/db/seed";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  REMONTÉE DU SUIVI VERS LE PROCESSEUR DE PAIEMENT                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Quand le gérant passe une commande en « expédiée » dans le back-office, le
 * transporteur et le numéro de suivi partent aussi vers le PSP qui a encaissé.
 *
 * POURQUOI. Aucun PSP ne ferme un compte faute de numéro de suivi — cette
 * version de la rumeur est fausse. Ce qu'ils surveillent, c'est le TAUX DE
 * LITIGES : au-delà de 0,75 % Stripe place le compte sous surveillance, au-delà
 * de 1 % il le ferme. Or le numéro de suivi est la preuve qui fait gagner les
 * contestations « colis jamais reçu », de loin la catégorie la plus fréquente.
 * Transmis à l'avance, il est déjà dans le dossier le jour où la contestation
 * arrive — au lieu d'être à retrouver et à ressaisir sous sept jours.
 *
 * ⚠️ RIEN ICI NE DOIT EMPÊCHER UNE EXPÉDITION. L'appelant enveloppe cette
 * fonction et ignore son résultat : un PSP injoignable, une clé changée, une
 * référence perdue ne doivent jamais bloquer le passage en « expédiée » ni
 * l'e-mail à la cliente. Au pire le suivi n'est pas remonté, et ça se voit dans
 * les journaux.
 *
 * ─── Brancher un nouveau PSP ──────────────────────────────────────────────
 * Ajouter un `case` dans `pousserSuiviAuPsp`. Il lui faut deux choses :
 * `order.pspRef` (renseigné à la création de la commande) et une API qui
 * accepte le suivi APRÈS encaissement — c'est le point qui manque le plus
 * souvent, cf. les cas « non pris en charge » ci-dessous.
 */

export type ResultatSuivi =
  | { etat: "transmis"; psp: string }
  | { etat: "ignore"; psp: string; raison: string }
  | { etat: "echec"; psp: string; raison: string };

/** Nom du PSP tel qu'enregistré sur la commande, ramené à un identifiant. */
function pspDe(order: Order): string {
  return (order.psp ?? "").trim().toLowerCase().split(/[\s(]/)[0];
}

export async function pousserSuiviAuPsp(order: Order): Promise<ResultatSuivi> {
  const psp = pspDe(order);
  const suivi = order.tracking;
  if (!suivi?.number) return { etat: "ignore", psp, raison: "aucun numéro de suivi" };
  if (!order.pspRef) {
    // Commandes antérieures à l'enregistrement de la référence de transaction.
    return { etat: "ignore", psp, raison: "référence de transaction inconnue" };
  }

  switch (psp) {
    case "stripe":
      return suiviStripe(order, order.pspRef, suivi.carrier, suivi.number);
    case "airwallex":
      return suiviAirwallex(order, order.pspRef, suivi.carrier, suivi.number);

    /*
      Fondy et Genome n'exposent aucune API pour rattacher un suivi à un
      paiement déjà encaissé : chez eux l'information de livraison se fournit
      à l'achat (`reservation_data` pour Fondy, claims `VALUE_*` pour Genome,
      cf. `lib/payments/identity.ts`) ou se dépose à la main dans leur
      back-office le jour d'une contestation. On ne simule pas un appel qui
      n'existe pas — le numéro reste dans notre back-office, où le gérant le
      retrouve en un clic.
    */
    case "fondy":
    case "genome":
      return {
        etat: "ignore",
        psp,
        raison: "ce PSP n'accepte pas de suivi après encaissement",
      };

    default:
      return { etat: "ignore", psp, raison: "PSP sans remontée de suivi" };
  }
}

/* ───────────────────────────── Stripe ───────────────────────────── */

/**
 * Stripe accepte `shipping` sur un PaymentIntent même APRÈS encaissement, avec
 * `carrier` et `tracking_number`.
 *
 * ⚠️ On relit d'abord le paiement pour repartir du `shipping` déjà posé à
 * l'achat : envoyer un `shipping` partiel l'ÉCRASE, et on perdrait le nom et
 * l'adresse — c'est-à-dire précisément les preuves qu'on cherche à conserver.
 */
async function suiviStripe(
  order: Order,
  ref: string,
  carrier: string,
  numero: string,
): Promise<ResultatSuivi> {
  const cfg = await getGatewayConfig("stripe");
  const secret = cfg?.credentials.secretKey;
  if (!secret) return { etat: "ignore", psp: "stripe", raison: "clés absentes" };

  try {
    const stripe = new Stripe(secret);
    const intent = await stripe.paymentIntents.retrieve(ref);
    const existant = intent.shipping;
    // Stripe renvoie `null` sur les champs vides, mais n'accepte que
    // `undefined` en écriture : on convertit, sinon TypeScript refuse et
    // l'API renverrait une erreur de validation.
    const sansNull = (v: string | null | undefined) => v ?? undefined;
    const a = existant?.address;
    await stripe.paymentIntents.update(ref, {
      shipping: {
        name: existant?.name ?? order.customer,
        phone: sansNull(existant?.phone) ?? order.phone ?? undefined,
        address: a
          ? {
              line1: sansNull(a.line1) ?? order.address ?? "",
              line2: sansNull(a.line2),
              city: sansNull(a.city),
              state: sansNull(a.state),
              postal_code: sansNull(a.postal_code),
              country: sansNull(a.country) ?? "FR",
            }
          : { line1: order.address ?? "", country: "FR" },
        carrier: carrierLabel(carrier),
        tracking_number: numero,
      },
    });
    return { etat: "transmis", psp: "stripe" };
  } catch (e) {
    const raison = e instanceof Error ? e.message : "erreur inconnue";
    console.warn("[suivi] Stripe :", raison);
    return { etat: "echec", psp: "stripe", raison };
  }
}

/* ──────────────────────────── Airwallex ──────────────────────────── */

/**
 * Airwallex ne documente pas de champ « numéro de suivi » sur un paiement
 * encaissé. On le dépose donc dans les `metadata` de l'intent, qui remontent
 * dans le rapport de transactions et servent de trace datée en cas de litige.
 *
 * ⚠️ Tentative honnête, pas promesse : leur API d'`update` est prévue pour
 * l'avant-confirmation. Si elle refuse un paiement déjà capturé, on le
 * journalise et on passe — le suivi reste dans notre back-office.
 */
async function suiviAirwallex(
  order: Order,
  ref: string,
  carrier: string,
  numero: string,
): Promise<ResultatSuivi> {
  const cfg = await getGatewayConfig("airwallex");
  const creds = airwallexCreds(cfg?.credentials);
  if (!creds) return { etat: "ignore", psp: "airwallex", raison: "clés absentes" };

  const { ok } = await airwallexAttachIdentity(
    creds,
    cfg?.mode === "live",
    ref,
    {
      metadata: {
        boutique: brand.name,
        commande: order.id,
        transporteur: carrierLabel(carrier),
        suivi: numero,
      },
    },
  );
  return ok
    ? { etat: "transmis", psp: "airwallex" }
    : {
        etat: "echec",
        psp: "airwallex",
        raison: "mise à jour refusée après encaissement",
      };
}
