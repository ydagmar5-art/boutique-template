import Link from "next/link";

/**
 * Habillage commun des pages légales (typographie « prose » maison).
 *
 * ⚠️ La date de mise à jour est une CONSTANTE, pas `new Date()` : une page
 * légale qui affiche « mis à jour aujourd'hui » à chaque visite ment sur sa
 * propre ancienneté et se repère au premier coup d'œil.
 *
 * ⚠️ Elle doit être postérieure à l'immatriculation de l'exploitant. Le
 * modèle affichait une date figée alors que l'exploitant a été
 * immatriculée le 3 août 2026 : des conditions de vente antérieures à
 * l'existence du vendeur sont un signal d'alarme pour un prestataire de
 * paiement comme pour un client.
 */
const DERNIERE_MISE_A_JOUR = "Dernière mise à jour : 3 août 2026";

export default function Legal({
  title,
  updated = DERNIERE_MISE_A_JOUR,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Accueil
      </Link>
      <h1 className="mt-4 font-heading text-4xl md:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">{updated}</p>
      <article className="legal mt-10 space-y-6 leading-relaxed text-ink/85">
        {children}
      </article>
    </div>
  );
}
