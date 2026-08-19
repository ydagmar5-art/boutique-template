import { brand } from "@/config/brand.config";

type IconName = "truck" | "lock" | "return" | "shield";

const ICONS: Record<IconName, React.ReactNode> = {
  truck: (
    <>
      <path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  return: (
    <>
      <path d="M3 9a9 9 0 0 1 15-3l3 3" /><path d="M21 4v5h-5" />
      <path d="M21 15a9 9 0 0 1-15 3l-3-3" /><path d="M3 20v-5h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

/** ⚠️ Engagements commerciaux — définis dans `config/brand.config.ts`. */
const ITEMS = brand.reassurances;

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[22px] w-[22px] shrink-0 text-primary-dark"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/**
 * Bloc de réassurances.
 * - "bar" (accueil) : rangée horizontale aérée.
 * - "compact" (fiche produit) : 4 colonnes fines séparées par des filets.
 */
export default function Reassurances({
  variant = "bar",
}: {
  variant?: "bar" | "compact";
}) {
  /*
    Variante « compact » (fiche produit). Angles droits : le cadre arrondi du
    modèle jurait avec le reste du site, et sautait aux yeux sur mobile où le
    bloc occupe toute la largeur. Icône à gauche du texte plutôt qu'au-dessus :
    en deux colonnes étroites, l'empilement centré donnait quatre cellules
    hautes et vides.
  */
  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-6 border-y border-line py-6 sm:grid-cols-4 sm:gap-x-6">
        {ITEMS.map((it) => (
          <div key={it.title} className="flex items-start gap-2.5">
            <Icon name={it.icon} />
            <div className="min-w-0">
              <p className="text-[0.72rem] font-medium leading-[1.3]">
                {it.title}
              </p>
              <p className="mt-1 text-[0.66rem] leading-[1.35] text-muted">
                {it.sub}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /*
    ⚠️ Était un `flex flex-wrap justify-center` : sur mobile, chaque ligne se
    centrait INDÉPENDAMMENT des autres, donc les icônes se retrouvaient à
    quatre abscisses différentes — un bloc en escalier, illisible.
    Grille 2×2 alignée sur mobile, rangée aérée à partir de `sm`.
  */
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-12 sm:gap-y-4">
      {ITEMS.map((it) => (
        <div key={it.title} className="flex items-start gap-2.5 sm:items-center sm:gap-3">
          <Icon name={it.icon} />
          <div className="min-w-0">
            <p className="text-[0.72rem] font-medium leading-[1.3] sm:text-sm sm:leading-tight">
              {it.title}
            </p>
            <p className="mt-1 text-[0.66rem] leading-[1.35] text-muted sm:mt-0 sm:text-xs">
              {it.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
