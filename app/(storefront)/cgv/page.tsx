import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = { title: "Conditions générales de vente" };

export default function CGV() {
  const l = brand.legal;
  return (
    <Legal title="Conditions générales de vente">
      <p>
        Les présentes conditions générales de vente (CGV) régissent les ventes
        de produits réalisées sur le site {brand.name}, édité par {l.operator}{" "}
        ({l.legalForm}), {l.address} — SIREN {l.siren}. Toute commande implique
        l&apos;acceptation sans réserve des présentes CGV.
      </p>

      <h2>Article 1 — Produits</h2>
      <p>
        Les produits proposés sont des luminaires décrits et présentés avec la
        plus grande exactitude possible. Les photographies ont une valeur
        illustrative et ne sont pas contractuelles. La disponibilité des
        produits est indiquée sur chaque fiche.
      </p>

      <h2>Article 2 — Prix</h2>
      <p>
        Les prix sont indiqués en euros, toutes taxes comprises ({l.vat}). Ils
        ne comprennent pas les frais de livraison, indiqués avant la validation
        de la commande. {brand.name} se réserve le droit de modifier ses prix à
        tout moment, étant entendu que le produit sera facturé sur la base du
        tarif en vigueur au moment de la commande.
      </p>

      <h2>Article 3 — Commande</h2>
      <p>
        Le client sélectionne les produits, valide son panier, renseigne ses
        coordonnées puis procède au paiement. La vente est considérée comme
        définitive après confirmation de la commande et encaissement du
        paiement. Un e-mail de confirmation récapitule la commande.
      </p>

      <h2>Article 4 — Paiement</h2>
      <p>
        Le paiement s&apos;effectue en ligne par carte bancaire via un
        prestataire de paiement sécurisé. Les données bancaires sont saisies
        dans un environnement chiffré et ne sont jamais stockées sur nos
        serveurs. La commande n&apos;est enregistrée qu&apos;après acceptation du
        paiement.
      </p>

      <h2>Article 5 — Livraison</h2>
      <p>
        Les produits sont livrés à l&apos;adresse indiquée par le client. Les
        délais de livraison sont communiqués à titre indicatif. En cas de retard,
        le client peut annuler la commande dans les conditions prévues par les
        articles L.216-1 et suivants du Code de la consommation. Les risques sont
        transférés au client à la remise physique du produit.
      </p>

      <h2>Article 6 — Droit de rétractation</h2>
      <p>
        Conformément aux articles L.221-18 et suivants du Code de la
        consommation, le client dispose d&apos;un délai de{" "}
        <strong>14 jours</strong> à compter de la réception pour exercer son
        droit de rétractation, sans avoir à justifier de motifs. Les modalités
        sont détaillées dans notre page{" "}
        <a href="/remboursement">Conditions de remboursement</a>.
      </p>

      <h2>Article 7 — Garanties légales</h2>
      <p>
        Tous les produits bénéficient de la garantie légale de conformité
        (articles L.217-3 et suivants du Code de la consommation) et de la
        garantie contre les vices cachés (articles 1641 et suivants du Code
        civil). En cas de non-conformité, le client peut obtenir la réparation ou
        le remplacement du produit, ou à défaut le remboursement.
      </p>

      <h2>Article 8 — Service client &amp; médiation</h2>
      <p>
        Pour toute question, contactez-nous à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a>. En cas de litige non résolu,
        le client peut recourir à un médiateur de la consommation ou à la
        plateforme européenne{" "}
        <a href="https://ec.europa.eu/consumers/odr">
          ec.europa.eu/consumers/odr
        </a>
        .
      </p>

      <h2>Article 9 — Droit applicable</h2>
      <p>
        Les présentes CGV sont soumises au droit français. Tout litige relatif à
        leur interprétation ou à leur exécution relève des tribunaux compétents.
      </p>
    </Legal>
  );
}
