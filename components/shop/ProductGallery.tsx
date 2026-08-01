"use client";

import { useEffect, useState } from "react";

/**
 * Galerie de la fiche produit.
 *
 * Cadre fixe en portrait 3/4, image en `object-cover` : elle remplit toujours
 * le cadre, sans bande. Le 3/4 n'est pas arbitraire — c'est le format de sortie
 * le plus courant des photos du catalogue, qui tombent alors pile. Les photos
 * plus allongées (9/16) sont rognées en haut et en bas, ce qui reste sans
 * conséquence tant que le luminaire est cadré au centre.
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

  /** Précharge les deux photos voisines : le clic suivant est instantané. */
  useEffect(() => {
    if (total < 2) return;
    for (const i of [active + 1, active - 1]) {
      const img = new Image();
      img.src = images[(i + total) % total];
    }
  }, [active, images, total]);

  if (!total) return null;
  const src = images[active];

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-[2rem] bg-surface">
        {/* Pas de `key` ni d'animation : le navigateur garde la photo précédente
            affichée le temps de décoder la suivante, sans clignotement. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={active === 0 ? name : `${name} — photo ${active + 1}`}
          loading="eager"
          decoding="async"
          className="aspect-[3/4] w-full object-cover"
        />

        {total > 1 && (
          <>
            <Arrow side="left" onClick={() => go(active - 1)} />
            <Arrow side="right" onClick={() => go(active + 1)} />
            <span className="absolute bottom-4 right-4 z-20 rounded-full bg-bg/85 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
              {active + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img + i}
              onClick={() => setActive(i)}
              aria-label={`Voir la photo ${i + 1}`}
              aria-current={i === active}
              className={`relative h-20 w-[60px] shrink-0 overflow-hidden rounded-lg border-2 bg-surface transition ${
                i === active
                  ? "border-primary"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
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
      className={`absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg/85 text-lg text-ink shadow-soft backdrop-blur transition hover:bg-bg md:opacity-0 md:group-hover:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
