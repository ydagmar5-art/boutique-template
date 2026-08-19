import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/site/Reveal";
import FrenchMark from "@/components/site/FrenchMark";
import type { MaisonSection as Maison } from "@/lib/actions/storefront";

/**
 * Bloc « La Maison » — le récit de la marque.
 *
 * Titre, texte et image se rédigent depuis le tableau de bord (`setMaison`).
 * Rien n'est en dur ici : ce composant ne fait que mettre en forme ce que le
 * gérant a saisi.
 *
 * ⚠️ COMPOSANT PARTAGÉ, monté sur l'accueil ET sur chaque fiche produit. Il a
 * été extrait précisément pour ça : recopier le balisage aurait garanti que
 * les deux versions divergent à la première retouche.
 *
 * ⚠️ L'ancre `id="maison"` est visée par la navigation (`brand.nav`). Elle ne
 * doit exister QU'UNE FOIS par page — d'où `ancre`, qu'on laisse à l'accueil
 * et qu'on retire sur les fiches produit, où le lien du menu doit continuer de
 * renvoyer vers l'accueil.
 */
export default function MaisonSection({
  maison,
  ancre = false,
  className = "",
}: {
  maison: Maison;
  /** Pose `id="maison"`. Réservé à la page qui porte la navigation. */
  ancre?: boolean;
  className?: string;
}) {
  const paragraphes = maison.texte
    .split(/\n\s*\n/)
    .map((par) => par.trim())
    .filter(Boolean);

  return (
    <section {...(ancre ? { id: "maison" } : {})} className={`scroll-mt-20 ${className}`}>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        {/* Deux colonnes AVEC image, une seule sans : laisser `grid-cols-2`
            quand le gérant retire le visuel tasserait le texte sur la moitié
            gauche, face à un vide de la largeur d'un écran. */}
        <div
          className={`grid gap-12 md:items-center md:gap-16 ${
            maison.image ? "md:grid-cols-2" : "max-w-2xl"
          }`}
        >
          <Reveal>
            <FrenchMark label="La Maison · Maison française" />
            {/* `whitespace-pre-line` : les retours à la ligne du titre sont
                voulus par le gérant — ils cassent la phrase là où il faut, au
                lieu de laisser le navigateur replier au petit bonheur. */}
            <h2 className="mt-4 whitespace-pre-line font-heading text-3xl font-light leading-tight md:text-4xl">
              {maison.titre}
            </h2>
            <div className="mt-7 space-y-5 leading-[1.8] text-muted">
              {paragraphes.map((par, i) => (
                // Un paragraphe n'a pas d'identité stable : son rang EST sa
                // clé, et l'ordre ne change qu'à la réécriture du bloc.
                <p key={i} className="whitespace-pre-line">
                  {par}
                </p>
              ))}
            </div>
            <Link
              href="/#savoir-faire"
              className="mt-9 inline-block text-[0.66rem] uppercase tracking-[0.18em] text-ink underline decoration-1 underline-offset-[7px] transition-opacity hover:opacity-60"
            >
              Mon savoir-faire
            </Link>
          </Reveal>
          {maison.image && (
            <Reveal delay={90}>
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
                <Image
                  src={maison.image}
                  alt={maison.alt}
                  fill
                  sizes="(min-width: 768px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
