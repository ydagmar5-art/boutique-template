import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  alternates: { canonical: "/confidentialite" },
};

export default function Confidentialite() {
  const l = brand.legal;
  return (
    <Legal title="Politique de confidentialité">
      <p>
        La présente politique décrit la manière dont {brand.name},
        boutique exploitée par {l.operator}, collecte et traite vos données
        personnelles. La boutique s&apos;adressant à une clientèle résidant en
        France, le Règlement général sur la protection des données (RGPD)
        s&apos;applique à ces traitements, ainsi que la loi Informatique et
        Libertés.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {l.operator}, société immatriculée au registre {l.registry} sous le
        numéro {l.registrationNumber}, dont le siège social est situé{" "}
        {l.address}. Contact :{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a>.
      </p>
      {/*
        ⚠️ Mention indispensable depuis que l'exploitant est une société
        britannique : les données quittent l'Espace économique européen. Le
        Royaume-Uni bénéficie d'une décision d'adéquation de la Commission
        européenne, ce qui rend le transfert licite sans garantie
        supplémentaire — mais l'omettre serait un manquement à l'information.
      */}
      <h2>Lieu de traitement des données</h2>
      <p>
        Le responsable du traitement étant établi au Royaume-Uni, vos données y
        sont traitées. Le Royaume-Uni fait l&apos;objet d&apos;une décision
        d&apos;adéquation de la Commission européenne : ce transfert bénéficie
        donc d&apos;un niveau de protection reconnu comme équivalent à celui de
        l&apos;Union européenne, sans formalité supplémentaire de votre part.
        Nos prestataires techniques (hébergement, envoi d&apos;e-mails, base de
        données) traitent les données au sein de l&apos;Union européenne ou sous
        garanties appropriées.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>Identité et coordonnées : nom, prénom, e-mail, adresse postale.</li>
        <li>Données de commande : produits, montants, historique d&apos;achat.</li>
        <li>
          Données de paiement : traitées directement par notre prestataire de
          paiement sécurisé — nous ne stockons aucune donnée bancaire.
        </li>
        <li>
          Données de navigation : via des cookies et outils de mesure
          d&apos;audience (voir ci-dessous).
        </li>
      </ul>

      <h2>Finalités &amp; bases légales</h2>
      <ul>
        <li>
          Gestion des commandes et de la relation client (exécution du contrat).
        </li>
        <li>
          Respect de nos obligations légales et comptables (obligation légale).
        </li>
        <li>
          Amélioration du site et mesure d&apos;audience (intérêt légitime ou
          consentement).
        </li>
        <li>
          Envoi d&apos;informations commerciales, le cas échéant (consentement).
        </li>
      </ul>

      <h2>Durée de conservation</h2>
      <p>
        Les données de commande sont conservées le temps nécessaire à la gestion
        de la relation client puis archivées conformément aux délais légaux
        (notamment 10 ans pour les pièces comptables). Les données liées aux
        cookies sont conservées 13 mois maximum.
      </p>

      <h2>Destinataires</h2>
      <p>
        Vos données sont destinées à {brand.name} et à ses sous-traitants
        strictement nécessaires (prestataire de paiement, transporteur,
        hébergeur, outils de mesure d&apos;audience). Elles ne sont jamais
        vendues à des tiers.
      </p>

      <h2>Cookies &amp; pixels de suivi</h2>
      <p>
        Le site peut utiliser des cookies et pixels de mesure et de publicité
        (par exemple Meta, TikTok, Snapchat, Pinterest, Google, Taboola) afin
        d&apos;analyser l&apos;audience et de mesurer l&apos;efficacité de nos
        campagnes. Ces traceurs ne sont déposés qu&apos;avec votre consentement,
        que vous pouvez retirer à tout moment.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification,
        d&apos;effacement, de limitation, d&apos;opposition et de portabilité de
        vos données. Pour les exercer, écrivez à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a>. Vous pouvez également
        introduire une réclamation auprès de la CNIL (
        <a href="https://www.cnil.fr">www.cnil.fr</a>).
      </p>
    </Legal>
  );
}
