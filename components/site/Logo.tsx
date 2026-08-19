import Link from "next/link";
import { brand } from "@/config/brand.config";

/**
 * Monogramme de démonstration : ligature à fût partagé, avec la goutte
 * caractéristique sous le sommet du chevron. Dessiné en SVG plutôt
 * qu'importé en image — net à toute taille, recolorable par `currentColor`,
 * aucun fichier à charger.
 *
 * Le tracé reprend le logo fourni par le client (monogramme doré sur papier
 * ivoire) en version filaire : à 32 px dans une barre de navigation, un
 * dégradé doré et une texture papier ne se lisent pas — un trait, si.
 *
 * ⚠️ Conserver le `<Link href="/">` et le `aria-label` : c'est le retour à
 * l'accueil sur toutes les pages, et le seul repère des lecteurs d'écran.
 */
function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 40"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {/* M — fût gauche, chevron, montée vers le fût partagé avec le R */}
      <path d="M4 35V6l14 22L32 6" />
      {/* R — fût, panse, jambe */}
      <path d="M32 6v29" />
      <path d="M32 6h4a5.5 5.5 0 0 1 0 11h-4" />
      <path d="m34 17 6 18" />
      {/* La goutte, sous le sommet du chevron */}
      <path d="M18 22c3.4 3.9 3.4 9.5 0 12.4-3.4-2.9-3.4-8.5 0-12.4Z" />
    </svg>
  );
}

export default function Logo({ tone = "ink" }: { tone?: "ink" | "light" }) {
  return (
    <Link
      href="/"
      aria-label={`${brand.name} Paris — accueil`}
      className={`group inline-flex items-center gap-3 ${
        tone === "light" ? "text-bg" : "text-ink"
      }`}
    >
      <Mark className="h-8 w-[2.2rem] shrink-0 transition-transform duration-500 group-hover:-translate-y-0.5" />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[0.8rem] font-normal tracking-[0.3em] sm:text-sm">
          {brand.name}
        </span>
        <span
          className={`mt-1 text-[0.5rem] font-medium tracking-[0.55em] ${
            tone === "light" ? "text-bg/55" : "text-muted"
          }`}
        >
          PARIS
        </span>
      </span>
    </Link>
  );
}
