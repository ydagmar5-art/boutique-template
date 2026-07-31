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
  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 divide-y divide-line rounded-2xl border border-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {ITEMS.map((it) => (
          <div
            key={it.title}
            className="flex flex-col items-center gap-1.5 px-3 py-5 text-center"
          >
            <Icon name={it.icon} />
            <p className="text-[13px] font-medium leading-tight">{it.title}</p>
            <p className="text-[11px] text-muted">{it.sub}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
      {ITEMS.map((it) => (
        <div key={it.title} className="flex items-center gap-3">
          <Icon name={it.icon} />
          <div>
            <p className="text-sm font-medium leading-tight">{it.title}</p>
            <p className="text-xs text-muted">{it.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
