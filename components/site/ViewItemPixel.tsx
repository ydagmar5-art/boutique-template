"use client";

import { useEffect, useRef } from "react";
import { pixelTrack, type PixelLineItem } from "@/lib/pixel-events";

/**
 * Déclenche « vue produit » à l'affichage d'une fiche.
 *
 * ⚠️ C'est la PREMIÈRE marche du tunnel d'achat : sans elle, Analytics ne sait
 * pas combien de visiteuses ont regardé un sac sans l'ajouter au panier — donc
 * ni quel sac attire, ni lequel décroche.
 *
 * ⚠️ Le repère est le SLUG, pas un booléen : Next.js garde le composant monté
 * d'une fiche à l'autre (navigation côté client). Avec un simple « déjà
 * envoyé », passer d'un produit à l'autre n'aurait rien déclenché.
 */
export default function ViewItemPixel({ item }: { item: PixelLineItem }) {
  const dernier = useRef<string | null>(null);

  useEffect(() => {
    if (dernier.current === item.id) return;
    dernier.current = item.id;
    pixelTrack("ViewItem", { value: item.price, items: [item] });
  }, [item]);

  return null;
}
