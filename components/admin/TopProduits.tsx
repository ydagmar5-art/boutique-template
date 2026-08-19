"use client";

import { useEffect, useState, useTransition } from "react";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { getTopProduits, type LigneProduit } from "@/lib/actions/analytics";

/**
 * Palmarès des modèles : les plus vendus, les plus ajoutés au panier.
 *
 * ⚠️ La colonne « ajouts » affiche DEUX chiffres : le total, et en dessous le
 * nombre de personnes. Dix ajouts par une seule visiteuse qui hésite et dix
 * ajouts par dix visiteuses différentes sont deux situations opposées — la
 * première signale un doute sur la fiche, la seconde une vraie demande.
 */

/**
 * ⚠️ Deux façons de compter, et elles ne se confondent pas.
 *
 * « 7 jours », « 30 jours »… sont des fenêtres GLISSANTES : les n × 24 heures
 * qui précèdent l'instant présent. « Aujourd'hui » est une fenêtre CALENDAIRE,
 * qui part de minuit — sinon le filtre montrerait les dernières vingt-quatre
 * heures, donc une partie de la veille, ce que personne n'appelle
 * « aujourd'hui ».
 *
 * D'où `depuisMinuit` plutôt qu'un `jours: 1` qui aurait l'air correct et
 * afficherait autre chose.
 */
const PERIODES = [
  { key: "today", label: "Aujourd'hui", jours: 1, depuisMinuit: true },
  { key: "7d", label: "7 jours", jours: 7, depuisMinuit: false },
  { key: "30d", label: "30 jours", jours: 30, depuisMinuit: false },
  { key: "90d", label: "90 jours", jours: 90, depuisMinuit: false },
  { key: "tout", label: "Tout", jours: 3650, depuisMinuit: false },
] as const;

type Cle = (typeof PERIODES)[number]["key"];

export default function TopProduits() {
  const [periode, setPeriode] = useState<Cle>("today");
  const [lignes, setLignes] = useState<LigneProduit[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    const p = PERIODES.find((x) => x.key === periode)!;
    const to = new Date();
    // Fuseau du NAVIGATEUR, comme l'entonnoir : « aujourd'hui » doit vouloir
    // dire la journée de celle qui regarde l'écran, pas celle du serveur.
    const from = p.depuisMinuit
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : new Date(to.getTime() - p.jours * 86400000);
    start(async () => {
      setLignes(await getTopProduits(from.toISOString(), to.toISOString()));
    });
  }, [periode]);

  /* « sur la période » n'a pas de sens quand la période est la journée en
     cours : une matinée calme est le cas NORMAL, et la formulation laisserait
     croire à un catalogue qui ne se vend pas. */
  const videMessage = (debut: string) =>
    periode === "today" ? `${debut} depuis minuit.` : `${debut} sur la période.`;

  const vendus = [...lignes].filter((l) => l.vendus > 0).sort((a, b) => b.vendus - a.vendus).slice(0, 10);
  const paniers = [...lignes].filter((l) => l.ajouts > 0).sort((a, b) => b.ajouts - a.ajouts).slice(0, 10);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Produits</h2>
        {/* `flex-wrap` : cinq boutons depuis l'ajout d'« Aujourd'hui »,
            ils débordaient de la carte sur un écran étroit. */}
        <div className="flex flex-wrap gap-1.5">
          {PERIODES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriode(p.key)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                periode === p.key
                  ? "bg-ink text-bg"
                  : "border border-line text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Palmares
          titre="Les plus vendus"
          vide={pending ? "Chargement…" : videMessage("Aucune vente")}
          lignes={vendus}
          rendu={(l) => (
            <>
              <span className="font-heading text-lg">{l.vendus}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {formatPrice(l.ca, brand.currency, brand.locale)}
              </span>
            </>
          )}
        />
        <Palmares
          titre="Les plus ajoutés au panier"
          vide={pending ? "Chargement…" : videMessage("Aucun ajout")}
          lignes={paniers}
          rendu={(l) => (
            <>
              <span className="font-heading text-lg">{l.ajouts}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {l.personnes} personne{l.personnes > 1 ? "s" : ""}
              </span>
            </>
          )}
        />
      </div>
    </div>
  );
}

function Palmares({
  titre,
  lignes,
  rendu,
  vide,
}: {
  titre: string;
  lignes: LigneProduit[];
  rendu: (l: LigneProduit) => React.ReactNode;
  vide: string;
}) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-muted">{titre}</h3>
      {lignes.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{vide}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {lignes.map((l, i) => (
            <li key={l.slug} className="flex items-start justify-between gap-4 py-3">
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="w-4 shrink-0 text-xs text-muted">{i + 1}</span>
                <span className="truncate text-sm">{l.nom}</span>
              </span>
              <span className="shrink-0 text-right">{rendu(l)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
