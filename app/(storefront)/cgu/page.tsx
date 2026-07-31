import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

export default function CGU() {
  const l = brand.legal;
  return (
    <Legal title="Conditions générales d'utilisation">
      <p>
        Les présentes conditions générales d&apos;utilisation (CGU) définissent
        les modalités d&apos;accès et d&apos;utilisation du site {brand.name},
        édité par {l.operator}. En accédant au site, l&apos;utilisateur accepte
        les présentes CGU.
      </p>

      <h2>Accès au site</h2>
      <p>
        Le site est accessible gratuitement à tout utilisateur disposant d&apos;un
        accès à Internet. L&apos;éditeur met en œuvre les moyens raisonnables
        pour assurer un accès de qualité, mais n&apos;est tenu à aucune
        obligation de résultat. L&apos;accès peut être interrompu pour des
        raisons de maintenance ou de force majeure.
      </p>

      <h2>Utilisation du site</h2>
      <p>
        L&apos;utilisateur s&apos;engage à utiliser le site conformément à sa
        destination et à ne pas porter atteinte à son bon fonctionnement, à sa
        sécurité, ni aux droits de tiers. Toute utilisation frauduleuse ou
        contraire aux présentes CGU peut entraîner la suspension de l&apos;accès.
      </p>

      <h2>Compte &amp; commandes</h2>
      <p>
        La création d&apos;un compte ou la passation d&apos;une commande implique
        la fourniture d&apos;informations exactes. L&apos;utilisateur est
        responsable de la confidentialité de ses identifiants et de toute
        activité effectuée depuis son compte.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les contenus du site sont la propriété exclusive de l&apos;éditeur ou de
        ses partenaires. Toute reproduction non autorisée est interdite.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans notre{" "}
        <a href="/confidentialite">Politique de confidentialité</a>.
      </p>

      <h2>Modification des CGU</h2>
      <p>
        L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout
        moment. Les CGU applicables sont celles en vigueur à la date de
        consultation du site.
      </p>
    </Legal>
  );
}
