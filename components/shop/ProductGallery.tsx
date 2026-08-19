"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";

/**
 * Galerie de la fiche produit.
 *
 * Cadre fixe en portrait 3/4, image en `object-cover` : elle remplit toujours
 * le cadre, sans bande. Le 3/4 n'est pas arbitraire — c'est le format de sortie
 * le plus courant des photos du catalogue, qui tombent alors pile. Les photos
 * plus allongées (9/16) sont rognées en haut et en bas, ce qui reste sans
 * conséquence tant que le sac est cadré au centre.
 *
 * ⚠️ `next/image` : les vignettes du bas font 60 px de large et tiraient
 * jusqu'ici le fichier de 1200 px — six fois par fiche. Elles réclament
 * désormais leur vraie largeur.
 */
export default function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const total = images.length;

  const go = (i: number) => setActive((i + total) % total);

  useEffect(() => {
    if (total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(active - 1);
      if (e.key === "ArrowRight") go(active + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /*
    Le préchargement manuel des photos voisines a été retiré : il tirait le
    fichier SOURCE (1200 px) alors que `next/image` sert une URL optimisée
    différente — on payait donc le téléchargement deux fois sans jamais
    réchauffer le bon cache. Les vignettes, elles, sont déjà chargées.
  */

  if (!total) return null;
  const src = images[active];

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[3/4] overflow-hidden bg-surface">
        {/* Pas de `key` ni d'animation : le navigateur garde la photo précédente
            affichée le temps de décoder la suivante, sans clignotement. */}
        <NextImage
          src={src}
          alt={active === 0 ? name : `${name} — photo ${active + 1}`}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />

        {total > 1 && (
          <>
            <Arrow side="left" onClick={() => go(active - 1)} />
            <Arrow side="right" onClick={() => go(active + 1)} />
            <span className="absolute bottom-4 right-4 z-20 bg-bg/85 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-muted backdrop-blur">
              {active + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/*
        Vignettes : une grille plutôt qu'une rangée qui déborde. En largeur
        fixe de 60 px et en `overflow-x-auto`, la dernière se retrouvait
        coupée au bord de l'écran sur mobile — on ne voyait pas qu'elle
        défilait, on croyait à un bug de mise en page.
      */}
      {total > 1 && (
        // Colonnes calculées d'après le NOMBRE de photos : un `grid-cols-6`
        // fixe laissait une colonne vide sur les modèles qui n'en ont que 4
        // ou 5, ce qui se lisait comme une image manquante.
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(total, 6)}, minmax(0, 1fr))`,
          }}
        >
          {images.map((img, i) => (
            <button
              key={img + i}
              onClick={() => setActive(i)}
              aria-label={`Voir la photo ${i + 1}`}
              aria-current={i === active}
              className={`relative aspect-[3/4] overflow-hidden bg-surface transition ${
                i === active
                  ? "opacity-100 ring-1 ring-ink"
                  : "opacity-55 hover:opacity-100"
              }`}
            >
              <NextImage
                src={img}
                alt=""
                fill
                sizes="(min-width: 768px) 90px, 60px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Arrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Photo précédente" : "Photo suivante"}
      /*
        Masquées sur mobile : elles se posaient en plein milieu du sac, et
        les vignettes juste en dessous font déjà le travail au doigt.
      */
      className={`absolute top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg/85 text-lg text-ink shadow-soft backdrop-blur transition hover:bg-bg md:flex md:opacity-0 md:group-hover:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
