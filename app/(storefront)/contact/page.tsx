import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import { store } from "@/config/store.config";
import Legal from "@/components/site/Legal";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact",
  description: `Écrire à ${brand.name} Paris. Réponse sous 48 heures ouvrées.`,
};

/**
 * Page de contact.
 *
 * ⚠️ Volontairement SANS formulaire : un formulaire de contact non branché à
 * une boîte de réception est pire que pas de formulaire du tout — le client
 * croit avoir écrit, personne ne reçoit rien. Une adresse e-mail cliquable
 * suffit, et c'est ce que cherchent les prestataires de paiement : un moyen
 * de joindre le marchand, identifiable et qui fonctionne.
 *
 * ⚠️ L'adresse indiquée ici DOIT recevoir réellement du courrier : c'est
 * aussi le `reply-to` de tous les e-mails transactionnels.
 */
export default function Contact() {
  const l = brand.legal;
  return (
    <Legal title="Contact">
      <p>
        Une question sur une pièce, une commande en cours, un retour ? Écrivez,
        c&apos;est une personne qui vous répond.
      </p>

      <h2>Par e-mail</h2>
      <p>
        <a href={`mailto:${l.email}`}>
          <strong>{l.email}</strong>
        </a>
        <br />
        Réponse sous <strong>48 heures ouvrées</strong>.
      </p>
      {l.phone && (
        <>
          <h2>Par téléphone</h2>
          <p>{l.phone}</p>
        </>
      )}

      <h2>Ce qu&apos;il me faut pour aller vite</h2>
      <ul>
        <li>
          Votre <strong>numéro de commande</strong> (au format {`${store.prefix.toUpperCase()}-0000`}),
          présent sur votre e-mail de confirmation
        </li>
        <li>Le modèle concerné, et une photographie s&apos;il s&apos;agit d&apos;un défaut</li>
        <li>L&apos;adresse e-mail utilisée lors de la commande</li>
      </ul>

      <h2>Adresse postale</h2>
      <p>
        {l.operator}
        <br />
        {l.address}
      </p>
      <p>
        Il s&apos;agit du siège social de la société. Merci de{" "}
        <strong>ne pas y expédier de retour</strong> sans m&apos;avoir écrit au
        préalable : l&apos;adresse de retour vous est communiquée par e-mail
        lors de la demande, et un colis envoyé spontanément peut se perdre.
      </p>

      <h2>Retours et remboursements</h2>
      <p>
        Les délais et la marche à suivre figurent sur la page{" "}
        <a href="/remboursement">Rétractation &amp; remboursement</a>. Pour la
        livraison, voir <a href="/livraison">Livraison</a>.
      </p>
    </Legal>
  );
}
