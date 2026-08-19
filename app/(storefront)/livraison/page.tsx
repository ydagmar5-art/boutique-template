import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = {
  alternates: { canonical: "/livraison" },
  title: "Livraison",
  description:
    "Expédition sous 48 heures ouvrées, Colissimo suivi, livraison offerte sur toutes les commandes.",
};

/**
 * Page de politique de livraison.
 *
 * ⚠️ Elle n'existait pas dans le modèle, et son absence est un motif de refus
 * courant à l'ouverture d'un compte de paiement : les prestataires cherchent
 * une page qui dise QUI expédie, SOUS QUEL DÉLAI, VERS OÙ et À QUEL PRIX.
 * Chaque chiffre ci-dessous doit rester aligné sur `brand.shippingDetail`,
 * sur les réassurances et sur l'article 6 des CGV.
 */
export default function Livraison() {
  const l = brand.legal;
  return (
    <Legal title="Livraison">
      <p>
        Chaque commande est préparée à la main, contrôlée une dernière fois,
        puis remise au transporteur. Voici ce à quoi vous pouvez vous attendre,
        sans zone d&apos;ombre.
      </p>

      <h2>Délai d&apos;expédition</h2>
      <p>
        Les commandes sont expédiées <strong>sous 48 heures ouvrées</strong> à
        compter de l&apos;encaissement du paiement. Les commandes passées le
        vendredi après-midi, le week-end ou un jour férié partent le jour
        ouvré suivant.
      </p>

      <h2>Transporteur et acheminement</h2>
      <p>
        Les colis sont confiés à <strong>Colissimo</strong>, avec suivi. Le
        délai d&apos;acheminement annoncé par La Poste est de deux à trois
        jours ouvrés en France métropolitaine après la prise en charge. Ce
        délai relève du transporteur et nous est donné à titre indicatif.
      </p>

      <h2>Frais de livraison</h2>
      <p>
        <strong>La livraison est offerte sur toutes les commandes</strong>, sans
        montant minimum. Aucun frais n&apos;est ajouté au moment du paiement :
        le total affiché au panier est celui qui est débité.
      </p>

      <h2>Zones desservies</h2>
      <p>
        Nous livrons en <strong>France métropolitaine</strong>. Pour une
        livraison en Corse, dans les départements et régions d&apos;outre-mer ou
        hors de France, écrivez-nous à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a> avant de commander : je vous
        confirmerai le délai et la faisabilité.
      </p>

      <h2>Suivi de votre commande</h2>
      <p>
        Un e-mail de confirmation part dès l&apos;encaissement. Un second
        e-mail, à l&apos;expédition, contient votre{" "}
        <strong>numéro de suivi</strong> et le lien pour suivre le colis
        jusqu&apos;à votre porte.
      </p>

      <h2>Colis perdu, retardé ou endommagé</h2>
      <p>
        En cas de retard anormal, de colis présenté comme livré sans que vous
        l&apos;ayez reçu, ou de produit abîmé à l&apos;ouverture, écrivez-nous à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a> en joignant si possible des
        photographies. Nous ouvrons une enquête auprès du transporteur et vous
        propose un renvoi ou un remboursement. Conformément aux articles
        L.216-1 et suivants du Code de la consommation, vous pouvez résoudre la
        vente si la commande n&apos;est pas livrée dans un délai raisonnable
        après mise en demeure.
      </p>

      <h2>Retours</h2>
      <p>
        Vous disposez de quatorze jours après réception pour changer
        d&apos;avis. Les modalités figurent sur la page{" "}
        <a href="/remboursement">Rétractation &amp; remboursement</a>.
      </p>
    </Legal>
  );
}
