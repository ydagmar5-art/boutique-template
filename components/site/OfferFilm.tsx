import Link from "next/link";
import { brand } from "@/config/brand.config";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECTION OFFRE — film en fond                                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * La date limite est FIXE et pilotée depuis le tableau de bord
 * (`lib/actions/storefront.ts`). Le composant est donc rendu côté SERVEUR :
 * aucun JavaScript n'est envoyé au navigateur pour cette section.
 *
 * ⚠️ Elle a remplacé un calcul « aujourd'hui + 5 jours ». Une échéance qui se
 * repousse toute seule à chaque visite annonce faussement la fin prochaine
 * d'une offre — l'article L121-4, 7° du Code de la consommation la répute
 * trompeuse en toutes circonstances, et c'est exactement le genre de détail
 * qu'examine un prestataire de paiement.
 *
 * ⚠️ Enregistrer la date appelle `revalidatePath("/", "layout")` : l'accueil
 * et les fiches produit sont générés en statique, sans quoi le changement
 * n'apparaîtrait qu'au prochain déploiement.
 *
 * ⚠️ La vidéo est MUETTE et sans piste audio (retirée à l'encodage) :
 * `muted` est de toute façon obligatoire pour que la lecture automatique soit
 * autorisée par les navigateurs. `playsInline` évite que iOS ne bascule en
 * plein écran.
 *
 * ⚠️ `prefers-reduced-motion` : la vidéo est remplacée par son image fixe
 * pour qui a désactivé les animations. Un fond animé non désactivable est un
 * problème d'accessibilité, pas un détail.
 */

/** Met la date limite en toutes lettres. `null` si absente ou invalide. */
function formatDeadline(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export default function OfferFilm({
  /** Texte du bouton — diffère entre l'accueil et une fiche produit. */
  cta = "Composer mon duo",
  href = "/products",
  /** Date limite `AAAA-MM-JJ` venue du back-office. Vide = rien d'affiché. */
  deadline: iso = "",
}: {
  cta?: string;
  href?: string;
  deadline?: string;
}) {
  const deadline = formatDeadline(iso);

  return (
    <section className="relative overflow-hidden bg-surface">
      {/*
        Cadre : portrait sur mobile, cinémascope à partir de md. Le sujet du
        film est cadré à DROITE, les deux tiers gauches sont vides — c'est là
        que le texte se pose. `object-position` décale le cadrage sur mobile
        pour garder la silhouette visible malgré le recadrage.

        ⚠️ PAS de `max-h` ici. Il y en avait un (34rem) : sur l'accueil, où la
        section occupe toute la largeur de l'écran, il écrasait le cadre
        au-dessus du rapport 21/9 et le recadrage vertical coupait la tête du
        mannequin. Sur une fiche produit, plus étroite, le plafond n'était
        jamais atteint — d'où un cadrage juste d'un côté et faux de l'autre.
        Le rapport seul suffit : il se comporte pareil quelle que soit la
        largeur.
      */}
      <div className="relative aspect-[3/4] w-full sm:aspect-[16/10] md:aspect-[21/9]">
        <video
          className="absolute inset-0 h-full w-full object-cover [object-position:68%_center] motion-reduce:hidden md:[object-position:50%_center]"
          poster="/film/offre-poster.webp"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src="/film/offre.webm" type="video/webm" />
          <source src="/film/offre.mp4" type="video/mp4" />
        </video>

        {/* Repli sans animation : l'image fixe du film. */}
        <div
          className="absolute inset-0 hidden bg-cover bg-[68%_center] motion-reduce:block md:bg-[50%_center]"
          style={{ backgroundImage: "url(/film/offre-poster.webp)" }}
          aria-hidden
        />

        {/*
          Voile de lisibilité. Le fond du film est clair : un dégradé BLANC,
          plus dense en bas sur mobile (où le texte passe sous la silhouette)
          et vers la gauche sur desktop (où il se pose sur le vide).
        */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent md:bg-gradient-to-r md:from-bg md:via-bg/80 md:to-transparent"
          aria-hidden
        />

        <div className="absolute inset-0 flex items-end md:items-center">
          <div className="mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8 md:pb-0">
            <div className="max-w-md motion-safe:animate-fade-up">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
                {brand.offer.eyebrow}
              </p>
              <h2 className="mt-4 font-heading text-[1.9rem] font-light leading-[1.15] text-ink sm:text-3xl md:text-[2.5rem]">
                {brand.offer.title}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted sm:text-[0.95rem]">
                {brand.offer.sub}
              </p>

              {deadline && (
                <p className="mt-5 text-[0.68rem] uppercase tracking-[0.18em] text-ink">
                  Jusqu&apos;au {deadline}
                </p>
              )}

              <Link
                href={href}
                className="mt-6 inline-block bg-ink px-9 py-[1.05rem] text-[0.64rem] uppercase tracking-[0.22em] text-bg transition-colors duration-300 hover:bg-primary-dark"
              >
                {cta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
