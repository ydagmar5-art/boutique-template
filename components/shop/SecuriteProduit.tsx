import {
  securiteProduit as s,
  securiteRenseignee,
  type OperateurEconomique,
} from "@/lib/securite-produit";

/**
 * Bloc « Sécurité et conformité » de la fiche produit.
 *
 * ⚠️ Imposé par le règlement (UE) 2023/988 pour toute vente à distance dans
 * l'Union. Il ne s'affiche que si `lib/securite-produit.ts` est renseigné :
 * une section à moitié remplie affirmerait une conformité qui n'est pas
 * établie. Voir le commentaire d'en-tête de ce fichier avant de le compléter.
 */
function Operateur({ titre, o }: { titre: string; o: OperateurEconomique }) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
        {titre}
      </p>
      <p className="mt-2 text-[0.95rem] font-semibold leading-snug">{o.nom}</p>
      <p className="mt-1 text-[0.9rem] leading-[1.6] text-muted">{o.adresse}</p>
      <a
        href={`mailto:${o.email}`}
        className="mt-1 inline-block text-[0.9rem] text-primary hover:opacity-70"
      >
        {o.email}
      </a>
    </div>
  );
}

export default function SecuriteProduit() {
  if (!securiteRenseignee) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="rounded-[1.5rem] border border-line bg-surface p-7 sm:p-10">
        <h2 className="font-heading text-[1.5rem] font-bold tracking-[-0.03em]">
          Sécurité et conformité
        </h2>
        <p className="mt-2 text-[0.9rem] text-muted">
          Informations exigées par le règlement (UE) 2023/988 relatif à la
          sécurité générale des produits.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {s.fabricant && <Operateur titre="Fabricant" o={s.fabricant} />}
          {s.representantUE && (
            <Operateur
              titre="Responsable dans l'Union européenne"
              o={s.representantUE}
            />
          )}
        </div>

        {s.modele && (
          <p className="mt-8 text-[0.9rem] text-muted">
            Référence du modèle : <strong className="text-ink">{s.modele}</strong>
          </p>
        )}

        {s.avertissements.length > 0 && (
          <div className="mt-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
              Avertissements
            </p>
            <ul className="mt-3 space-y-2">
              {s.avertissements.map((a) => (
                <li key={a} className="text-[0.95rem] leading-[1.7] text-muted">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.marquages.length > 0 && (
          <p className="mt-8 text-[0.85rem] text-muted">
            Marquages : {s.marquages.join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}
