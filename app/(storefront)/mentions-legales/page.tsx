import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  alternates: { canonical: "/mentions-legales" },
};

/**
 * ⚠️ Aucune mention française d'immatriculation ici : l'exploitant est une
 * société de droit anglais, qui n'a ni SIREN, ni SIRET, ni code APE. Le
 * modèle d'origine les imposait ; les afficher vides ou inventés serait une
 * fausse mention légale, et c'est le premier point contrôlé lors de
 * l'ouverture d'un compte de paiement.
 *
 * ⚠️ La ligne TVA n'apparaît QUE si un numéro est renseigné dans
 * `brand.legal.vatNumber`. L'article 19 de la LCEN n'impose ce numéro qu'aux
 * assujettis : mieux vaut l'omettre que d'affirmer un statut fiscal non
 * vérifié.
 */
export default function MentionsLegales() {
  const l = brand.legal;
  return (
    <Legal title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        Le site <strong>{brand.name}</strong> est édité par{" "}
        <strong>{l.operator}</strong>, {l.legalForm}.
      </p>
      <ul>
        <li>Siège social : {l.address}</li>
        <li>
          Immatriculée au registre {l.registry}, sous le numéro{" "}
          <strong>{l.registrationNumber}</strong>, le {l.incorporatedOn}
        </li>
        {l.vatNumber ? (
          <li>Numéro de TVA : {l.vatNumber}</li>
        ) : (
          l.vatNotice && <li>{l.vatNotice}</li>
        )}
        <li>
          Contact : <a href={`mailto:${l.email}`}>{l.email}</a>
          {l.phone ? ` — ${l.phone}` : ""}
        </li>
      </ul>
      <p>
        Les prix affichés sur la boutique sont indiqués en euros et sont
        définitifs. Aucun frais de livraison n&apos;est ajouté au moment du
        paiement.
      </p>

      <h2>Directeur de la publication</h2>
      <p>{l.director}, en qualité de directeur de {l.operator}.</p>

      <h2>Hébergeur</h2>
      <p>
        Le site est hébergé par <strong>{l.host.name}</strong>, {l.host.address}.
        Site&nbsp;: <a href={l.host.url}>{l.host.url}</a>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus présents sur le site {brand.name} (textes,
        visuels, logos, éléments graphiques, mise en page) est protégé par le
        droit de la propriété intellectuelle. Toute reproduction ou
        représentation, totale ou partielle, sans autorisation préalable écrite
        de l&apos;éditeur est interdite.
      </p>

      <h2>Responsabilité</h2>
      <p>
        L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des
        informations diffusées sur le site. Il ne saurait toutefois être tenu
        responsable des erreurs, d&apos;une absence de disponibilité des
        informations ou de la présence de virus sur son site.
      </p>

      <h2>Réclamations et médiation de la consommation</h2>
      <p>
        Toute réclamation peut être adressée à{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a>. Nous nous engageons à y
        répondre sous quarante-huit heures ouvrées et à rechercher une solution
        amiable.
      </p>
      <p>
        Conformément à l&apos;article L.612-1 du Code de la consommation, si
        votre réclamation écrite n&apos;a pas abouti dans un délai de deux mois,
        vous pouvez saisir gratuitement notre médiateur de la consommation :
      </p>
      <ul>
        <li>{l.mediator.name}</li>
        <li>{l.mediator.address}</li>
        <li>
          Saisine en ligne :{" "}
          <a href={l.mediator.url} target="_blank" rel="noreferrer">
            {l.mediator.url.replace(/^https?:\/\//, "")}
          </a>
        </li>
      </ul>
      <p>
        Le recours à la médiation est gratuit pour le consommateur et ne fait
        pas obstacle à une action en justice.
      </p>
      <p>
        La boutique s&apos;adressant à une clientèle résidant en France,
        celle-ci conserve le bénéfice des dispositions impératives du droit
        français de la consommation, quelle que soit la loi applicable au
        contrat.
      </p>
    </Legal>
  );
}
