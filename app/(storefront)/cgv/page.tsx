import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  alternates: { canonical: "/cgv" },
};

/**
 * ⚠️ Trois corrections par rapport au modèle, toutes vérifiables :
 *  · l'exploitant est une société anglaise : plus de SIREN, mais le numéro
 *    Companies House ;
 *  · les frais de livraison étaient annoncés « en sus » alors qu'aucun
 *    n'est calculé au panier — une CGV qui contredit le tunnel de paiement
 *    est un motif de refus classique chez les prestataires de paiement ;
 *  · la plateforme européenne de règlement en ligne des litiges a fermé en
 *    juillet 2025 : le lien renvoyait vers une page morte.
 */
export default function CGV() {
  const l = brand.legal;
  return (
    <Legal title="Conditions générales de vente">
      <p>
        Les présentes conditions générales de vente régissent les ventes de
        produits réalisées sur le site {brand.name} PARIS, édité par{" "}
        <strong>{l.operator}</strong> ({l.legalForm}), {l.address}, immatriculée
        au registre {l.registry} sous le numéro {l.registrationNumber}. Toute
        commande implique l&apos;acceptation sans réserve des présentes
        conditions.
      </p>

      <h2>Article 1 — Produits</h2>
      <p>
        Les produits proposés sont des sacs à main et articles de maroquinerie
        en cuir, décrits et présentés avec la plus grande exactitude possible.
        Les photographies ont une valeur illustrative et ne sont pas
        contractuelles ; les teintes peuvent varier légèrement selon
        l&apos;écran. Les caractéristiques essentielles de chaque modèle
        figurent sur sa fiche produit.
      </p>

      <h2>Article 2 — Prix</h2>
      <p>
        Les prix sont indiqués en euros et sont définitifs.{" "}
        {l.vatNumber ? `Numéro de TVA de l'exploitant : ${l.vatNumber}.` : l.vatNotice}{" "}
        <strong>Aucun frais de livraison n&apos;est ajouté</strong> : le montant
        affiché au panier est le montant débité. {brand.name} se réserve le
        droit de modifier ses prix à tout moment, étant entendu que le produit
        est facturé sur la base du tarif en vigueur au moment de la commande.
      </p>

      <h2>Article 3 — Offres promotionnelles</h2>
      <p>
        L&apos;offre « {brand.offer.short} » s&apos;applique automatiquement dès
        que le panier comporte deux articles ou plus, sans code ni date limite.
        La remise porte sur l&apos;article le moins cher de chaque paire. Les
        codes promotionnels éventuels se cumulent à cette offre et
        s&apos;appliquent sur le montant déjà remisé. Le détail du calcul est
        affiché dans le récapitulatif avant tout paiement.
      </p>

      <h2>Article 4 — Commande</h2>
      <p>
        Le client sélectionne les produits, valide son panier, renseigne ses
        coordonnées puis procède au paiement. La vente est définitive après
        confirmation de la commande et encaissement du paiement. Un e-mail de
        confirmation récapitulant la commande est envoyé immédiatement.
      </p>

      <h2>Article 5 — Paiement</h2>
      <p>
        Le paiement s&apos;effectue en ligne par carte bancaire, via un
        prestataire de paiement agréé. Les données bancaires sont saisies
        directement dans l&apos;environnement chiffré du prestataire et ne
        transitent jamais par nos serveurs, où elles ne sont donc ni traitées ni
        conservées. Chaque paiement est soumis à une authentification forte
        (3-D Secure). La commande n&apos;est enregistrée qu&apos;après
        acceptation du paiement par la banque du client.
      </p>

      <h2>Article 6 — Livraison</h2>
      <p>
        Les commandes sont expédiées <strong>sous 48 heures ouvrées</strong>{" "}
        après encaissement, en <strong>Colissimo suivi</strong>, à
        l&apos;adresse indiquée par le client. La livraison est offerte sur
        toutes les commandes. Un numéro de suivi est communiqué par e-mail au
        départ du colis. Les délais d&apos;acheminement du transporteur sont
        donnés à titre indicatif ; en cas de retard, le client dispose des
        droits prévus aux articles L.216-1 et suivants du Code de la
        consommation. Les risques sont transférés au client à la remise physique
        du produit. Le détail figure sur notre page{" "}
        <a href="/livraison">Livraison</a>.
      </p>

      <h2>Article 7 — Droit de rétractation</h2>
      <p>
        Conformément aux articles L.221-18 et suivants du Code de la
        consommation, le client dispose d&apos;un délai de{" "}
        <strong>14 jours</strong> à compter de la réception pour exercer son
        droit de rétractation, sans avoir à justifier de motifs ni à payer de
        pénalité. Les modalités et le formulaire type figurent sur notre page{" "}
        <a href="/remboursement">Rétractation &amp; remboursement</a>.
      </p>

      <h2>Article 8 — Garanties légales</h2>
      <p>
        Tous les produits bénéficient de la garantie légale de conformité
        (articles L.217-3 et suivants du Code de la consommation) et de la
        garantie contre les vices cachés (articles 1641 et suivants du Code
        civil). En cas de défaut de conformité, le client peut obtenir la
        réparation ou le remplacement du produit et, à défaut, son
        remboursement. Ces garanties s&apos;appliquent indépendamment de toute
        garantie commerciale.
      </p>

      <h2>Article 9 — Service client et médiation</h2>
      <p>
        Pour toute question relative à une commande, écrivez à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a>. Nous répondons sous
        quarante-huit heures ouvrées. Voir également notre page{" "}
        <a href="/contact">Contact</a>.
      </p>
      <p>
        Conformément à l&apos;article L.612-1 du Code de la consommation, si
        votre réclamation écrite n&apos;a pas abouti dans un délai de deux mois,
        vous pouvez saisir gratuitement <strong>{l.mediator.name}</strong>,{" "}
        {l.mediator.address} —{" "}
        <a href={l.mediator.url} target="_blank" rel="noreferrer">
          {l.mediator.url.replace(/^https?:\/\//, "")}
        </a>
        . Le recours à la médiation est gratuit pour le consommateur et ne fait
        pas obstacle à une action en justice.
      </p>

      {/*
        ⚠️ La loi désignée ici doit être celle du pays d'IMMATRICULATION de
        l'exploitant — l'Angleterre. Les réseaux de cartes (Visa, Mastercard)
        refusent d'activer un marchand dont les conditions désignent un autre
        droit que celui de sa société, et la demande d'activation est rejetée
        tant que les deux ne concordent pas.

        Ce choix ne retire RIEN au client français : l'article 6.2 du règlement
        Rome I lui laisse, pour un contrat conclu à distance avec un
        professionnel qui dirige son activité vers son pays, le bénéfice de
        toutes les règles impératives de son pays de résidence. C'est ce qui
        maintient debout les articles 6 à 9 ci-dessus, tous fondés sur le Code
        de la consommation français.
      */}
      <h2>Article 10 — Droit applicable et juridiction</h2>
      <p>
        Les présentes conditions sont régies par le{" "}
        <strong>droit d&apos;Angleterre et du Pays de Galles</strong>, pays
        d&apos;immatriculation de {l.operator}.
      </p>
      <p>
        Ce choix ne prive pas le consommateur résidant dans l&apos;Union
        européenne de la protection que lui assurent les dispositions
        impératives de son pays de résidence, conformément à l&apos;article 6.2
        du règlement (CE) n° 593/2008 dit « Rome I ». Le client résidant en
        France conserve donc l&apos;intégralité des droits que lui reconnaît le
        Code de la consommation français, notamment le droit de rétractation de
        quatorze jours et les garanties légales rappelés aux articles 7 et 8
        ci-dessus.
      </p>
      <p>
        En cas de litige, une solution amiable sera recherchée avant toute
        action judiciaire, le cas échéant par la médiation prévue à
        l&apos;article 9. À défaut d&apos;accord, le consommateur peut saisir
        soit les juridictions du lieu de son domicile, soit celles du siège de{" "}
        {l.operator}.
      </p>
    </Legal>
  );
}
