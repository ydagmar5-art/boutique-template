import Link from "next/link";
import { brand } from "@/config/brand.config";

/**
 * Monogramme de départ : l'initiale de la marque dans un cercle, aux couleurs
 * de la palette. Volontairement générique — il fonctionne pour n'importe quelle
 * niche et se remplace à chaque boutique.
 *
 * Le remplacer par un vrai signe :
 *   · dessiner en SVG dans ce composant (préféré : net à toute taille, se
 *     recolore avec `currentColor`, aucun fichier à charger)
 *   · ou poser un fichier dans `public/` et l'afficher ici
 *
 * ⚠️ Conserver le `<Link href="/">` et le `aria-label` : c'est le retour à
 * l'accueil sur toutes les pages, et le seul repère des lecteurs d'écran.
 */
function Mark({ className = "" }: { className?: string }) {
  const initial = brand.name.trim().charAt(0).toUpperCase() || "S";
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none">
      <circle
        cx="20"
        cy="20"
        r="18.5"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.55"
      />
      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize="17"
        fontFamily="var(--font-heading)"
        letterSpacing="0.5"
      >
        {initial}
      </text>
    </svg>
  );
}

export default function Logo({ tone = "ink" }: { tone?: "ink" | "light" }) {
  return (
    <Link
      href="/"
      aria-label={brand.name}
      className={`group inline-flex items-center gap-2.5 ${
        tone === "light" ? "text-bg" : "text-ink"
      }`}
    >
      <Mark className="h-8 w-8 text-primary transition-transform duration-500 group-hover:-translate-y-0.5" />
      <span className="font-heading text-xl font-medium tracking-[0.34em]">
        {brand.name}
      </span>
    </Link>
  );
}
