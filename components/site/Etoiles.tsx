/**
 * Étoiles de notation.
 *
 * ⚠️ Tracé VECTORIEL, pas le caractère « ★ » : ce dernier est rendu par la
 * police du système, change de dessin d'un appareil à l'autre et s'aligne mal
 * sur la ligne de base. Le demi-remplissage d'une note à 4,5 serait par
 * ailleurs impossible avec un caractère.
 */
export default function Etoiles({
  note,
  className = "",
}: {
  note: number;
  className?: string;
}) {
  const pleines = Math.floor(note);
  const demi = note - pleines >= 0.25 && note - pleines < 0.75;
  const arrondi = note - pleines >= 0.75 ? pleines + 1 : pleines;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-primary ${className}`}
      aria-label={`${note.toString().replace(".", ",")} sur 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const remplie = i < arrondi;
        const moitie = demi && i === pleines;
        return (
          <svg key={i} viewBox="0 0 20 19" className="h-[1em] w-[1em]" aria-hidden>
            <defs>
              <linearGradient id={`demi-${i}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="M10 0.8l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L10 14.6 4.4 17.9l1.4-6.3L1 7.3l6.4-.6z"
              fill={moitie ? `url(#demi-${i})` : remplie ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
              opacity={remplie || moitie ? 1 : 0.28}
            />
          </svg>
        );
      })}
    </span>
  );
}
