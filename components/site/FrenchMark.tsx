import { brand } from "@/config/brand.config";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MENTION « MAISON FRANÇAISE »                                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ SURTOUT PAS L'ÉMOJI 🇫🇷. Un émoji drapeau est rendu par la police
 * système : il change de dessin sur chaque appareil, arrive bombé et
 * brillant sur iOS, et casse net le registre monochrome de la boutique.
 * Ici c'est un tracé vectoriel, aux proportions et aux couleurs officielles
 * de la République (#000091 · #FFFFFF · #E1000F).
 *
 * ⚠️ Le filet de contour n'est pas décoratif : sans lui, la bande blanche
 * du milieu disparaît sur le fond blanc du site et le drapeau se lit
 * « bleu | rouge ».
 *
 * ⚠️ FORMULATION. « Maison française » désigne l'origine de la MARQUE, ce
 * qui est exact. Ne jamais la transformer en « Fabrication française » ni
 * en « Made in France » : ce serait une allégation sur l'origine du PRODUIT
 * (art. L121-2 du Code de la consommation), passible de deux ans
 * d'emprisonnement et d'une amende pouvant atteindre 10 % du chiffre
 * d'affaires — et c'est l'un des premiers signaux que cherchent les
 * prestataires de paiement à l'ouverture d'un compte.
 */

/**
 * ⚠️ MENTION MASQUÉE TANT QUE L'EXPLOITANT N'EST PAS RENSEIGNÉ.
 *
 * « Maison française » est une allégation sur l'origine de la MARQUE. Une
 * boutique fraîchement clonée l'affichait pourtant dès le premier rendu,
 * alors que `brand.legal.operator` valait encore « À RENSEIGNER » — et alors
 * que l'exploitant peut très bien être immatriculé ailleurs qu'en France.
 * C'est une affirmation invérifiable, et c'est l'un des premiers points que
 * contrôlent la DGCCRF et les prestataires de paiement.
 *
 * Le garde ci-dessous ne vérifie QUE le renseignement, pas le pays : à
 * l'exploitant d'une société étrangère de retirer ce composant de sa vitrine,
 * ou de changer le `label` pour une mention exacte.
 */
const EXPLOITANT_RENSEIGNE = !brand.legal.operator.includes("À RENSEIGNER");

function Drapeau({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 12"
      className={className}
      aria-hidden
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width="6" height="12" fill="#000091" />
      <rect x="6" y="0" width="6" height="12" fill="#FFFFFF" />
      <rect x="12" y="0" width="6" height="12" fill="#E1000F" />
      <rect
        x="0.35"
        y="0.35"
        width="17.3"
        height="11.3"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="0.7"
      />
    </svg>
  );
}

export default function FrenchMark({
  /** `full` : drapeau + mention. `flag` : le drapeau seul. */
  variant = "full",
  className = "",
  /** Mention affichée. Doit rester une origine de MARQUE, jamais de produit. */
  label = "Maison française",
}: {
  variant?: "full" | "flag";
  className?: string;
  label?: string;
}) {
  if (!EXPLOITANT_RENSEIGNE) return null;

  if (variant === "flag") {
    return (
      <span className={`inline-flex text-ink ${className}`} title={label}>
        <Drapeau className="h-3 w-[1.125rem]" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2.5 text-ink ${className}`}
    >
      <Drapeau className="h-3 w-[1.125rem] shrink-0" />
      <span className="text-[0.6rem] uppercase tracking-[0.28em]">{label}</span>
    </span>
  );
}
