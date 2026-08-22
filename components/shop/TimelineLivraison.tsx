"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CALENDRIER DE LIVRAISON                                         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Trois jalons : commande aujourd'hui, expédition demain, réception dans une
 * FOURCHETTE. Une date se projette là où un délai se calcule.
 *
 * ⚠️ LA RÉCEPTION EST UNE FOURCHETTE, PAS UNE DATE SÈCHE. Annoncer « jeudi »
 * quand les CGV disent « 3 à 5 jours ouvrés » crée un engagement plus étroit
 * que celui qu'on tient : le premier colis arrivé vendredi devient un retard
 * opposable (art. L216-2), alors qu'il est dans les clous. La fourchette dit
 * la même chose que les CGV, dans le même document.
 *
 * ⚠️ DATES CALCULÉES CÔTÉ CLIENT après montage. Un rendu serveur les figerait
 * à la génération de la page : mise en cache lundi, elle annoncerait encore
 * « commandé lundi » le jeudi suivant. Un squelette de même hauteur évite le
 * saut de mise en page à l'arrivée des vraies valeurs.
 *
 * ⚠️ SAMEDIS ET DIMANCHES SAUTÉS : ni l'entrepôt ni les transporteurs ne
 * travaillent le week-end, et annoncer une expédition un dimanche est une
 * promesse intenable.
 *
 * ⚠️ L'animation ne démarre qu'à l'entrée dans le cadre, et rien ne bouge
 * sous `prefers-reduced-motion` : tout s'affiche alors d'emblée.
 */

function ajouterJoursOuvres(depart: Date, n: number): Date {
  const d = new Date(depart);
  let restants = n;
  while (restants > 0) {
    d.setDate(d.getDate() + 1);
    const jour = d.getDay();
    if (jour !== 0 && jour !== 6) restants--;
  }
  return d;
}

const jourMois = (d: Date) =>
  d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const courtJourMois = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export default function TimelineLivraison({ compact = false }: { compact?: boolean }) {
  const cadre = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduit, setReduit] = useState(false);
  const [dates, setDates] = useState<string[] | null>(null);

  useEffect(() => {
    setReduit(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const aujourdhui = new Date();
    const envoi = ajouterJoursOuvres(aujourdhui, 1);
    // Fourchette de réception : 3 à 5 jours ouvrés après la commande,
    // exactement ce qu'annoncent les CGV et la page livraison.
    const tot = ajouterJoursOuvres(aujourdhui, 3);
    const tard = ajouterJoursOuvres(aujourdhui, 5);
    setDates([
      jourMois(aujourdhui),
      jourMois(envoi),
      `entre le ${courtJourMois(tot)} et le ${courtJourMois(tard)}`,
    ]);
  }, []);

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), {
      threshold: 0.25,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const actif = reduit || visible;

  const etapes = [
    { titre: "Commande", detail: "Paiement confirmé, préparation lancée." },
    { titre: "Expédition", detail: "Le colis quitte notre entrepôt en France." },
    { titre: "Réception", detail: "Livré chez vous, livraison offerte." },
  ];

  return (
    <div
      ref={cadre}
      className={`overflow-hidden rounded-[1.25rem] border border-line bg-surface ${
        compact ? "p-5" : "p-6 sm:p-7"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
          Votre livraison
        </p>
        <p className="text-[0.85rem] text-muted">Estimation, jours ouvrés</p>
      </div>

      {/* Rail de progression : il se remplit une fois quand le bloc entre
          dans le cadre. Un rail qui se remplit dit « ça avance » mieux que
          trois points figés. */}
      <div className="relative mt-6">
        <div
          className={`absolute left-0 right-0 top-[7px] h-[3px] rounded-full bg-line ${
            compact ? "hidden" : "hidden sm:block"
          }`}
        />
        <div
          aria-hidden
          className={`absolute left-0 top-[7px] h-[3px] rounded-full bg-primary transition-[width] duration-[1600ms] ease-out ${
            compact ? "hidden" : "hidden sm:block"
          }`}
          style={{ width: actif ? "100%" : "0%" }}
        />

        <ol className={`grid gap-y-6 ${compact ? "" : "sm:grid-cols-3 sm:gap-x-4"}`}>
          {etapes.map((e, i) => (
            <li
              key={e.titre}
              className={`${compact ? "flex gap-3.5" : "relative"} transition-all duration-700 ease-out`}
              style={{
                opacity: actif ? 1 : 0,
                transform: actif ? "translateY(0)" : "translateY(8px)",
                transitionDelay: reduit ? "0ms" : `${i * 260}ms`,
              }}
            >
              {compact ? (
                <div className="flex flex-col items-center">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full transition-colors duration-500"
                    style={{
                      background: actif ? "var(--c-primary)" : "var(--c-border)",
                      transitionDelay: reduit ? "0ms" : `${i * 260}ms`,
                    }}
                  />
                  {i < etapes.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                </div>
              ) : (
                <span
                  aria-hidden
                  className="mb-4 block h-[17px] w-[17px] rounded-full border-[3px] border-bg ring-[3px] transition-colors duration-500"
                  style={{
                    background: actif ? "var(--c-primary)" : "var(--c-border)",
                    // `ring` en variable : la pastille doit se détacher du
                    // rail qui passe derrière elle.
                    ["--tw-ring-color" as string]: actif
                      ? "var(--c-primary)"
                      : "var(--c-border)",
                    transitionDelay: reduit ? "0ms" : `${i * 260}ms`,
                  }}
                />
              )}

              <div className={compact ? "pb-1" : ""}>
                <p className="font-heading text-[0.95rem] font-bold">{e.titre}</p>
                {dates ? (
                  <p
                    className={`mt-0.5 font-heading text-[0.98rem] font-bold first-letter:capitalize ${
                      i === 2 ? "text-primary" : "text-ink"
                    }`}
                  >
                    {dates[i]}
                  </p>
                ) : (
                  <span className="mt-1 block h-[1.15rem] w-32 animate-pulse rounded bg-halo" />
                )}
                {!compact && (
                  <p className="mt-1.5 text-[0.88rem] leading-[1.5] text-muted">{e.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
