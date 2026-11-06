import { ImageResponse } from "next/og";
import { brand } from "@/config/brand.config";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  FAVICON — généré depuis la marque, jamais hérité d'une autre    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ Le modèle servait un `app/icon.svg` fixe : le monogramme M+R de
 * Maison Romy Paris. Il survivait sur CHAQUE nouvelle boutique (constaté
 * sur Casa Pilates, novembre 2026). Désormais le favicon est construit à
 * partir de `brand` : l'initiale de `brand.name`, en `colors.bg` sur une
 * pastille `colors.ink`. Une boutique neuve a donc d'office SON favicon.
 *
 * Pour un favicon dessiné (le pictogramme du logo) : supprimer ce fichier
 * et poser un `app/icon.svg` à la place — fond plein, trait épaissi pour
 * rester lisible à 16 px.
 *
 * Généré une fois au build (aucun paramètre dynamique), servi en PNG.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  const initiale = (brand.name.match(/\p{L}|\p{N}/u)?.[0] ?? "•").toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.colors.ink,
          color: brand.colors.bg,
          borderRadius: 14,
          fontSize: 42,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {initiale}
      </div>
    ),
    size,
  );
}
