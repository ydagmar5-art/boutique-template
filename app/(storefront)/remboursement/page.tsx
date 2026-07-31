import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = { title: "Conditions de remboursement" };

export default function Remboursement() {
  const l = brand.legal;
  return (
    <Legal title="Rétractation &amp; remboursement">
      <h2>Droit de rétractation</h2>
      <p>
        Conformément aux articles L.221-18 et suivants du Code de la
        consommation, vous disposez d&apos;un délai de <strong>14 jours</strong>{" "}
        à compter de la réception de votre commande pour vous rétracter, sans
        avoir à justifier de motif ni à payer de pénalité.
      </p>

      <h2>Comment exercer votre droit</h2>
      <p>
        Pour exercer votre droit de rétractation, informez-nous de votre
        décision par une déclaration dénuée d&apos;ambiguïté, par e-mail à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a> ou par courrier à l&apos;adresse{" "}
        {l.address}. Vous pouvez utiliser le modèle de formulaire de
        rétractation, sans que cela soit obligatoire.
      </p>

      <h2>Retour des produits</h2>
      <p>
        Vous devez renvoyer le produit sans retard excessif et au plus tard{" "}
        <strong>14 jours</strong> après nous avoir communiqué votre décision. Le
        produit doit être retourné dans son état et son emballage d&apos;origine,
        complet et non endommagé. Les frais directs de renvoi sont à votre
        charge, sauf mention contraire.
      </p>

      <h2>Remboursement</h2>
      <p>
        Nous vous rembourserons l&apos;intégralité des sommes versées, y compris
        les frais de livraison standard, au plus tard{" "}
        <strong>14 jours</strong> à compter de la date à laquelle nous sommes
        informés de votre décision de rétractation. Nous pouvons différer le
        remboursement jusqu&apos;à réception du produit ou jusqu&apos;à ce que
        vous ayez fourni une preuve d&apos;expédition. Le remboursement est
        effectué par le même moyen de paiement que celui utilisé lors de la
        commande.
      </p>

      <h2>Produits endommagés ou non conformes</h2>
      <p>
        Si vous recevez un produit défectueux ou non conforme, contactez-nous
        dans les meilleurs délais à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a> avec votre numéro de commande
        et, si possible, des photographies. Le retour et le remboursement (ou le
        remplacement) seront alors pris en charge par nos soins au titre des
        garanties légales.
      </p>

      <h2>Exceptions</h2>
      <p>
        Le droit de rétractation ne s&apos;applique pas aux biens confectionnés
        selon les spécifications du consommateur ou nettement personnalisés
        (article L.221-28 du Code de la consommation).
      </p>
    </Legal>
  );
}
