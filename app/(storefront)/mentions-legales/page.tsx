import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = { title: "Mentions légales" };

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
        <li>SIREN : {l.siren}</li>
        <li>SIRET (siège) : {l.siret}</li>
        <li>Code APE : {l.ape}</li>
        <li>{l.vat}</li>
        <li>
          Contact :{" "}
          <a href={`mailto:${l.email}`}>{l.email}</a>
          {l.phone ? ` — ${l.phone}` : ""}
        </li>
      </ul>

      <h2>Directeur de la publication</h2>
      <p>{l.director}.</p>

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

      <h2>Médiation de la consommation</h2>
      <p>
        Conformément à l&apos;article L.612-1 du Code de la consommation, le
        consommateur peut recourir gratuitement à un médiateur de la
        consommation en vue de la résolution amiable d&apos;un litige. La
        plateforme européenne de règlement en ligne des litiges est accessible à
        l&apos;adresse&nbsp;:{" "}
        <a href="https://ec.europa.eu/consumers/odr">
          ec.europa.eu/consumers/odr
        </a>
        .
      </p>
    </Legal>
  );
}
