import { reviews, dateAvis, MENTION_AVIS, type Review } from "@/lib/reviews";
import Etoiles from "@/components/site/Etoiles";
import type React from "react";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MUR D'AVIS DÉFILANT — trois bandes, aucun JavaScript            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Remplace la grille de six avis. Avec plus de cent retours, une grille
 * imposait soit un mur de texte interminable, soit un « voir plus » qui
 * cache justement ce qui rassure. Trois bandes qui défilent donnent le
 * VOLUME d'un coup d'œil — c'est le volume qui convainc, pas la lecture
 * exhaustive.
 *
 * ⚠️ TOUS LES AVIS SONT DANS LE DOM, et c'est délibéré. Google exige que la
 * note globale déclarée en JSON-LD corresponde aux avis réellement présents
 * sur la page. N'en afficher qu'un extrait tout en annonçant le total est un
 * motif d'action manuelle — perte des étoiles dans les résultats.
 *
 * ⚠️ DÉFILEMENT EN CSS PUR. Chaque piste contient deux copies de sa moitié et
 * se translate de −50 % : la boucle est invisible et rien n'est à
 * réinitialiser. Un carrousel piloté par `setInterval` ajouterait un travail
 * continu au fil principal, sur une page qui porte déjà une vidéo.
 *
 * ⚠️ POIDS : cartes 100 % texte, aucune image, aucun état client. Le coût est
 * du DOM, pas du réseau ni du calcul. La seconde copie de chaque piste porte
 * `aria-hidden` pour ne pas doubler la lecture d'un lecteur d'écran.
 *
 * ⚠️ Bandes en sens ALTERNÉ : trois pistes défilant du même côté se lisent
 * comme un seul bloc qui glisse, et donnent le tournis.
 *
 * ⚠️ `prefers-reduced-motion` fige les bandes (`marquee-track` dans
 * globals.css) : elles redeviennent trois rangées lisibles.
 */

/** Découpe en `n` paquets de tailles voisines, en conservant l'ordre. */
function repartir<T>(liste: T[], n: number): T[][] {
  const paquets: T[][] = Array.from({ length: n }, () => []);
  liste.forEach((e, i) => paquets[i % n].push(e));
  return paquets;
}

function Carte({ r }: { r: Review }) {
  return (
    <figure className="flex w-[17rem] shrink-0 flex-col rounded-[1.15rem] border border-line bg-surface p-5 sm:w-[19.5rem]">
      {/* ⚠️ Étoiles en CSS (2 nœuds) et non le composant SVG (31 nœuds) :
          multiplié par les 228 cartes du mur, l'écart faisait à lui seul
          plus de sept mille nœuds DOM. Voir `globals.css`. */}
      <span
        className="etoiles-css text-[0.8rem]"
        style={{ "--n": r.rating } as React.CSSProperties}
        aria-label={`${r.rating} sur 5`}
      >
        <i />
      </span>
      <figcaption className="mt-3 font-heading text-[0.98rem] font-bold leading-snug tracking-[-0.02em]">
        {r.title}
      </figcaption>
      {/* ⚠️ Hauteur bornée : un avis long ferait grandir toute la bande et
          casserait l'alignement des trois pistes. */}
      <p className="mt-2 line-clamp-4 text-[0.88rem] leading-[1.6] text-muted">
        {r.body}
      </p>
      {/* ⚠️ Auteur et date dans UN SEUL élément, sans <time> ni <span>.
          Trois nœuds économisés par carte, soit près de sept cents sur le
          mur. La date reste balisée proprement là où un moteur la lit
          vraiment : le `datePublished` du JSON-LD. */}
      <p className="mt-4 text-[0.8rem] text-muted">
        <b className="font-semibold text-ink">{r.author}</b>
        {" · "}
        {dateAvis(r.date)}
      </p>
    </figure>
  );
}

export default function CarrouselAvis({
  titre = "Ce qu'ils en disent.",
  note,
}: {
  titre?: string;
  /** Moyenne affichée à côté du titre. Omise = pas de note. */
  note?: number;
}) {
  if (reviews.length === 0) return null;

  const pistes = repartir(reviews, 3);

  return (
    <section id="avis" className="scroll-mt-16 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h2 className="font-heading text-[2rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[2.6rem]">
            {titre}
          </h2>
          {typeof note === "number" && note > 0 && (
            <div className="flex items-center gap-3">
              <Etoiles note={note} className="text-[1.05rem]" />
              <span className="font-heading text-[1.25rem] font-bold tabular-nums">
                {note.toString().replace(".", ",")} / 5
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {pistes.map((piste, i) => (
          <div key={i} className="group overflow-hidden">
            <div
              className={`marquee-track flex w-max gap-4 animate-marquee group-hover:[animation-play-state:paused] ${
                i % 2 === 1 ? "[animation-direction:reverse]" : ""
              }`}
              /* Durée proportionnelle à la longueur : sans ça, la piste la
                 plus courte filerait et la plus longue ramperait. */
              style={{ animationDuration: `${piste.length * 4.5}s` }}
            >
              {[0, 1].map((copie) => (
                <div key={copie} className="flex shrink-0 gap-4" aria-hidden={copie === 1}>
                  {piste.map((r) => (
                    <Carte key={r.author + r.title + copie} r={r} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mention de transparence — art. L111-7-2. */}
      <div className="mx-auto mt-8 max-w-6xl px-5 sm:px-8">
        <p className="max-w-2xl text-[0.8rem] leading-[1.7] text-muted">
          {MENTION_AVIS}
        </p>
      </div>
    </section>
  );
}
