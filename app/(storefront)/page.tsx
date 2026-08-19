/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PAGE D'ACCUEIL                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Direction « Galerie » : monochrome, blanc franc, aucun aplat de couleur.
 * Le cuir est le seul élément coloré de la page.
 *
 * ⚠️ CONSERVÉ de l'implémentation de référence (ne pas retirer) :
 *   1. `listFeatured()` comme source des modèles mis en avant — jamais de
 *      catalogue en dur, sinon le back-office ne pilote plus rien.
 *   2. `<ProductCard>` : porte le lien vers la fiche et le formatage du prix.
 *   3. Les ancres `id="maison"` et `id="savoir-faire"`, visées par `brand.nav`.
 *   4. `<Reveal>` pour les apparitions au défilement : il respecte
 *      `prefers-reduced-motion`.
 *
 * ⚠️ RÈGLES DE CONTENU arrêtées avec le gérant :
 *   · Le hero vient de `getHeroProduct()` — il se change depuis le tableau de
 *     bord, sans toucher au code (le gérant fait de l'A/B test dessus).
 *   · NE JAMAIS compter les modèles ni annoncer une amplitude de prix : le
 *     catalogue bouge au gré de la production des ateliers.
 *   · Aucun émoji nulle part.
 *   · Les avis viennent de `lib/reviews.ts` et sont RÉELS.
 *   · Le formulaire de lettre est BRANCHÉ (`lib/actions/newsletter.ts`) :
 *     il enregistre l'adresse et déclenche l'e-mail de bienvenue. Ne pas le
 *     remplacer par le champ décoratif du modèle.
 */
import Link from "next/link";
import Image from "next/image";
import { brand } from "@/config/brand.config";
import { LIGNES } from "@/lib/collections";
import { listFeatured } from "@/lib/actions/products";
import { getHeroProduct, getStorefrontSettings } from "@/lib/actions/storefront";
import { formatPrice } from "@/lib/products";
import { reviews, averageRating } from "@/lib/reviews";
import ProductCard from "@/components/shop/ProductCard";
import Price from "@/components/shop/Price";
import Reassurances from "@/components/site/Reassurances";
import Reveal from "@/components/site/Reveal";
import PaymentBadges from "@/components/site/PaymentBadges";
import NewsletterForm from "@/components/site/NewsletterForm";
import FrenchMark from "@/components/site/FrenchMark";
import OfferFilm from "@/components/site/OfferFilm";
import MaisonSection from "@/components/site/MaisonSection";
import JsonLd from "@/components/site/JsonLd";
import { organisationJsonLd, siteJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

/*
  Canonique auto-référente. ⚠️ Elle n'est PAS décorative ici : les 346
  épingles Pinterest pointent vers des adresses portant `?utm_source=…`,
  que Google verrait sinon comme autant de pages distinctes affichant le
  même contenu. La canonique les rattache toutes à l'adresse propre, sans
  toucher ni aux liens ni à l'attribution.
*/
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};



function Etoiles({ note, className = "" }: { note: number; className?: string }) {
  return (
    <span
      className={`tracking-[0.15em] text-ink ${className}`}
      aria-label={`${note} sur 5`}
    >
      {"★".repeat(Math.round(note))}
      <span className="text-border">{"★".repeat(5 - Math.round(note))}</span>
    </span>
  );
}

export default async function HomePage() {
  const [featured, hero, reglages] = await Promise.all([
    listFeatured(),
    getHeroProduct(),
    getStorefrontSettings(),
  ]);
  const note = averageRating();


  return (
    <>
      <JsonLd donnees={organisationJsonLd()} />
      <JsonLd donnees={siteJsonLd()} />

      {/* ░░ HERO ░░ */}
      <section className="border-b border-line">
        {/*
          ░░ Deux heros, un par format ░░

          DESKTOP : deux blocs de texte à gauche, le packshot à droite avec
          son cartouche nom / accroche / prix. Placement EXPLICITE en grille
          (`col-start` / `row-start`) plutôt qu'un `order`, qui ne saurait pas
          regrouper les deux blocs de texte dans la même colonne.

          MOBILE : titre, phrase d'accroche, appels à l'action. Ni packshot ni
          film — le CARTOUCHE nom + accroche + PRIX est écarté parce qu'il est
          la signature visuelle d'une fiche article, et le film de campagne a
          été retiré parce qu'il repoussait le premier bouton sous la ligne de
          flottaison.

          ⚠️ Le bloc packshot ne se charge QUE sur desktop (`hidden md:block`,
          porté par le lien lui-même) : sur mobile il n'existe pas du tout,
          plutôt que d'être masqué après coup.
        */}
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-y-9 py-11 md:grid-cols-[0.95fr_1.05fr] md:content-center md:gap-x-16 md:py-20 lg:gap-x-24">
            <div className="order-1 animate-fade-up md:col-start-1 md:row-start-1 md:self-end">
              <FrenchMark />
              <h1 className="mt-6 font-heading text-[2.4rem] font-light leading-[1.1] tracking-[-0.015em] text-balance sm:text-5xl lg:text-[3.6rem]">
                Le cuir se juge
                <br />
                à ce qu&apos;il devient.
              </h1>
            </div>

            {hero && (
              <Link
                href={`/products/${hero.slug}`}
                /* `hidden md:block` sur le LIEN lui-même : ne laisser que son
                   contenu masqué garderait une zone cliquable vide et une
                   animation inutile dans la grille mobile. */
                className="group order-3 hidden animate-fade-up md:col-start-2 md:row-start-1 md:row-span-2 md:block md:self-center [animation-delay:120ms]"
              >
                {/* ── Desktop : packshot + cartouche ── */}
                <div className="hidden md:block">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
                    <Image
                      src={hero.images[0]}
                      alt={`${hero.name}, ${hero.tagline.toLowerCase()}`}
                      fill
                      priority
                      sizes="55vw"
                      className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4 border-t border-line pt-4">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-ink">
                        {hero.name}
                      </p>
                      <p className="mt-1.5 text-[0.72rem] text-muted">
                        {hero.tagline}
                      </p>
                    </div>
                    <span className="whitespace-nowrap">
                      <Price
                        prix={hero.price}
                        prixBarre={hero.compareAtPrice}
                        taille="petit"
                      />
                    </span>
                  </div>
                </div>

              </Link>
            )}

            {/*
              Le film de campagne qui occupait cette place sur mobile a été
              retiré : il poussait le texte et le premier appel à l'action
              sous la ligne de flottaison, sur l'écran d'où vient l'essentiel
              du trafic. Le film de l'offre, plus bas, reste en place.
            */}

            <div className="order-2 animate-fade-up md:col-start-1 md:row-start-2 md:self-start [animation-delay:60ms]">
              <p className="max-w-md leading-[1.75] text-muted md:mt-7">
                Des pièces coupées dans des cuirs pleine fleur, montées pour
                tenir leur ligne des années. Nous ne dessinons pas pour une saison.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Link
                  href="/products"
                  className="w-full bg-ink px-10 py-[1.15rem] text-center text-[0.66rem] uppercase tracking-[0.22em] text-bg transition-colors duration-300 hover:bg-primary-dark sm:w-auto"
                >
                  Découvrir la collection
                </Link>
                <Link
                  href="/#maison"
                  className="text-[0.66rem] uppercase tracking-[0.18em] text-ink underline decoration-1 underline-offset-[7px] transition-opacity hover:opacity-60"
                >
                  Notre histoire
                </Link>
              </div>

              <div className="mt-9 flex items-center gap-3 border-t border-line pt-6">
                <Etoiles note={note} className="text-sm" />
                <span className="text-[0.72rem] text-muted">
                  {note.toString().replace(".", ",")} sur 5 — avis vérifiés
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ░░ RÉASSURANCES — juste après le hero ░░ */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <Reassurances />
        </div>
      </section>

      {/* ░░ LES LIGNES ░░ */}
      <section className="border-b border-line">
        <nav
          aria-label="Les lignes de la collection"
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-6 sm:px-8"
        >
          {/* Vers les pages de LIGNE, pas vers un filtre : ce sont elles qui
              portent le référencement des termes « cabas », « sac seau »… */}
          {LIGNES.map((l) => (
            <Link
              key={l.slug}
              href={`/collections/${l.slug}`}
              className="text-[0.62rem] uppercase tracking-[0.24em] text-muted transition-colors hover:text-ink"
            >
              {l.nom}
            </Link>
          ))}
        </nav>
      </section>

      {/* ░░ SÉLECTION ░░ */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <div className="mb-14 max-w-xl">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
            La sélection
          </p>
          <h2 className="mt-4 font-heading text-3xl font-light leading-tight md:text-4xl">
            Les pièces que vous portez le plus.
          </h2>
        </div>
        <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 80}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link
            href="/products"
            className="text-[0.66rem] uppercase tracking-[0.18em] text-ink underline decoration-1 underline-offset-[7px] transition-opacity hover:opacity-60"
          >
            Voir toute la collection
          </Link>
        </div>
      </section>

      {/* ░░ LA MAISON ░░ — balisage dans `components/site/MaisonSection`,
          partagé avec les fiches produit. `ancre` : l'accueil est la seule
          page à porter `id="maison"`, cible du menu. */}
      <MaisonSection maison={reglages.maison} ancre />

      {/* ░░ L'OFFRE — film en fond, texte et échéance par-dessus ░░ */}
      <OfferFilm deadline={reglages.offerDeadline} />

      {/* ░░ SAVOIR-FAIRE ░░ */}
      <section
        id="savoir-faire"
        className="scroll-mt-20 border-t border-line bg-surface"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 md:grid-cols-2 md:gap-16 md:py-28">
          <Reveal>
            <div className="relative aspect-square w-full overflow-hidden bg-bg">
              <Image
                src="/products/minuit-5.webp"
                alt="Détail de piqûre sur le modèle Minuit"
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={90}>
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
              Savoir-faire
            </p>
            <h2 className="mt-4 font-heading text-3xl font-light leading-tight md:text-4xl">
              Trois épreuves
              <br />
              avant d&apos;entrer en collection.
            </h2>
            <div className="mt-10 space-y-7">
              {[
                [
                  "I",
                  "La tenue à vide",
                  "Un sac se juge vide, jamais rempli. Posé sur une table, il doit garder sa ligne. S'il s'affaisse là, il s'affaissera à l'épaule dans six mois.",
                ],
                [
                  "II",
                  "La piqûre",
                  "Points réguliers, fils arrêtés, aucune reprise visible dans les angles. C'est le seul endroit où le temps passé à la fabrication se lit à l'œil nu.",
                ],
                [
                  "III",
                  "La quincaillerie",
                  "Un fermoir doit se fermer d'une main et rester fermé. Nous pesons le laiton : le poids du métal en dit plus long sur sa durée de vie que sa couleur.",
                ],
              ].map(([n, t, d]) => (
                <div key={n} className="flex gap-7 border-t border-line pt-6">
                  <span className="font-heading text-sm font-light text-muted">
                    {n}
                  </span>
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-ink">
                      {t}
                    </p>
                    <p className="mt-2.5 text-sm leading-[1.75] text-muted">
                      {d}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ░░ AVIS — réels, cf. lib/reviews.ts ░░ */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <Reveal className="mb-14 text-center">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
            Elles l&apos;ont reçu
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Etoiles note={note} className="text-lg" />
            <span className="font-heading text-xl font-light">
              {note.toString().replace(".", ",")} / 5
            </span>
          </div>
        </Reveal>

        <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal
              key={r.author + r.title}
              delay={(i % 3) * 80}
              className="border-t border-line pt-7"
            >
              <Etoiles note={r.rating} className="text-[0.7rem]" />
              <p className="mt-4 text-[0.72rem] uppercase tracking-[0.16em] text-ink">
                {r.title}
              </p>
              <p className="mt-3 text-sm leading-[1.75] text-muted">{r.body}</p>
              <p className="mt-5 text-[0.68rem] uppercase tracking-[0.16em] text-muted">
                {r.author}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ░░ LA LETTRE ░░ */}
      <section className="border-t border-line bg-surface">
        <Reveal className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8 md:py-20">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
            La lettre
          </p>
          <h2 className="mt-5 font-heading text-2xl font-light leading-snug md:text-3xl">
            Dix pour cent sur votre première pièce.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
            Inscrivez-vous pour être prévenue en premier des nouvelles pièces
            et des rééditions. Votre code de bienvenue arrive dans la foulée,
            cumulable avec les offres en cours.
          </p>
          <div className="mt-9">
            <NewsletterForm />
          </div>
        </Reveal>
      </section>

      {/* ░░ CLÔTURE ░░ */}
      <section className="border-t border-line">
        <Reveal className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8 md:py-28">
          <h2 className="font-heading text-3xl font-light leading-tight md:text-4xl">
            Une pièce se choisit une fois.
          </h2>
          <p className="mx-auto mt-5 max-w-sm leading-relaxed text-muted">
            Livraison offerte, quatorze jours pour changer d&apos;avis,
            paiement sécurisé par 3-D Secure.
          </p>
          <Link
            href="/products"
            className="mt-10 inline-block bg-ink px-10 py-[1.15rem] text-[0.66rem] uppercase tracking-[0.22em] text-bg transition-colors duration-300 hover:bg-primary-dark"
          >
            Voir la collection
          </Link>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-line pt-8">
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
              Paiement sécurisé
            </span>
            <PaymentBadges />
          </div>
        </Reveal>
      </section>
    </>
  );
}
