"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOfferDeadline } from "@/lib/actions/storefront";

/**
 * Date limite de l'offre, repoussée à la main par le gérant.
 *
 * ⚠️ Volontairement une date FIXE, et non un compte à rebours qui se
 * réarme : annoncer faussement la fin prochaine d'une offre est une pratique
 * commerciale trompeuse en toutes circonstances (art. L121-4, 7°). Vider le
 * champ retire simplement la mention du site.
 */
export default function OfferDeadlinePicker({ current }: { current: string }) {
  const router = useRouter();
  const [date, setDate] = useState(current);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const enregistrer = (value: string) => {
    setDate(value);
    setSaved(false);
    start(async () => {
      await setOfferDeadline(value);
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 2500);
    });
  };

  const lisible = date
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(`${date}T12:00:00`))
    : null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Date limite de l&apos;offre</h2>
          <p className="mt-0.5 text-xs text-muted">
            Affichée sur l&apos;accueil et les fiches produit.
          </p>
        </div>
        {pending && <span className="text-xs text-muted">Enregistrement…</span>}
        {saved && !pending && (
          <span className="text-xs text-organic">Enregistré</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          disabled={pending}
          onChange={(e) => enregistrer(e.target.value)}
          aria-label="Date limite de l'offre"
          className="rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-50"
        />
        {date && (
          <button
            onClick={() => enregistrer("")}
            disabled={pending}
            className="text-xs text-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
          >
            Retirer l&apos;échéance
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        {lisible
          ? `Le site affiche : « Jusqu'au ${lisible} ».`
          : "Aucune échéance n'est affichée sur le site."}
      </p>
    </div>
  );
}
