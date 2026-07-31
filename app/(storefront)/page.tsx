/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PAGE D'ACCUEIL — implémentation de référence                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Cette page est de la PEAU : elle se réécrit intégralement à chaque
 * boutique (« copie tel site », autre niche, autre discours). Rien ici
 * n'est sacré — sauf les quatre points ci-dessous.
 *
 * ⚠️ À CONSERVER quelle que soit la refonte :
 *   1. `listFeatured()` comme source des produits mis en avant — ne jamais
 *      écrire un catalogue en dur dans la page, l'admin ne le verrait pas.
 *   2. `<ProductCard>` pour chaque produit : il porte le lien vers la fiche
 *      et le formatage du prix selon la devise de la marque.
 *   3. Les ancres `id="histoire"` et `id="savoir-faire"` si `brand.nav` y
 *      renvoie — sinon les liens du menu tombent dans le vide.
 *   4. `<Reveal>` pour les apparitions au défilement : il respecte
 *      `prefers-reduced-motion`, une animation maison ne le fera pas.
 *
 * Structure actuelle (AIDA) : hero → réassurances → parti pris →
 * collection → histoire → savoir-faire → avis → CTA → newsletter.
 * Elle a fait ses preuves, mais elle n'est qu'un point de départ.
 */
import Link from "next/link";
import { brand } from "@/config/brand.config";
import { listFeatured } from "@/lib/actions/products";
import ProductCard from "@/components/shop/ProductCard";
import Reassurances from "@/components/site/Reassurances";
import Reveal from "@/components/site/Reveal";
import PaymentBadges from "@/components/site/PaymentBadges";

function Stars({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-0.5 text-primary ${className}`} aria-label="5 étoiles sur 5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i}>★</span>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const featured = await listFeatured();

  return (
    <>
      {/* ░░ ATTENTION — HERO ░░ */}
      <section className="grain relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 sm:px-8 md:grid-cols-2 md:pb-24 md:pt-20">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-primary-dark">
                {brand.name}
              </span>
            </div>
            <h1 className="mt-6 font-heading text-5xl leading-[1.05] text-balance sm:text-6xl md:text-7xl">
              La promesse qui <em className="text-primary not-italic">accroche</em>{" "}
              le regard
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Une phrase qui dit ce que le client obtient concrètement, et pour
              qui c&apos;est fait. Pas ce que vous vendez — ce que ça change
              pour lui.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                className="rounded-full bg-ink px-8 py-4 text-sm font-medium text-bg transition-all duration-300 hover:scale-[0.98] hover:bg-primary-dark"
              >
                Découvrir la collection
              </Link>
              <Link
                href="/#histoire"
                className="text-sm font-medium text-ink underline-offset-4 transition hover:text-primary-dark hover:underline"
              >
                Notre histoire →
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <Stars />
              <span className="text-sm text-muted">
                Preuve sociale — à remplacer par un chiffre vrai
              </span>
            </div>
          </div>

          <div className="relative animate-fade-up [animation-delay:150ms]">
            <div className="absolute -right-10 -top-10 h-64 w-64 animate-glow rounded-full bg-halo blur-3xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/products/demo-un-1.svg"
              alt="Visuel principal de la boutique"
              className="relative z-10 aspect-[4/5] w-full rounded-[2rem] object-cover shadow-soft"
            />
            <div className="absolute -bottom-6 -left-6 z-20 rounded-2xl border border-line bg-bg/95 px-5 py-4 shadow-glow backdrop-blur">
              <p className="font-heading text-lg">Modèle Un</p>
              <p className="text-xs font-medium tracking-wide text-primary-dark">
                Produit mis en avant
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ░░ RÉASSURANCES ░░ */}
      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
          <Reassurances />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-line pt-5">
            <span className="text-xs uppercase tracking-wider text-muted">
              Paiement 100 % sécurisé
            </span>
            <PaymentBadges />
          </div>
        </div>
      </section>

      {/* ░░ INTÉRÊT — LE PARTI PRIS (éditorial) ░░ */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <div className="grid gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-20">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-primary-dark">
              Le parti pris
            </p>
            <h2 className="mt-4 font-heading text-4xl leading-tight md:text-5xl">
              La conviction qui vous distingue.
            </h2>
            <p className="mt-6 leading-relaxed text-muted">
              Deux phrases sur ce qui vous sépare des concurrents. Un avis
              tranché convainc mieux qu&apos;une liste de qualités.
            </p>
          </Reveal>

          <div>
            {[
              [
                "I",
                "Premier argument",
                "Le bénéfice le plus fort, formulé du point de vue du client. Concret, vérifiable, pas un superlatif.",
              ],
              [
                "II",
                "Deuxième argument",
                "Ce qui rassure sur la qualité : matière, procédé, contrôle. Un détail précis vaut mieux qu'une promesse vague.",
              ],
              [
                "III",
                "Troisième argument",
                "Ce qui lève la dernière objection : garantie, retour, service. C'est souvent lui qui déclenche l'achat.",
              ],
            ].map(([num, title, desc], i) => (
              <Reveal
                key={title}
                delay={i * 90}
                className="flex gap-6 border-t border-line py-7 first:border-t-0 first:pt-0 last:pb-0"
              >
                <span className="font-heading text-xl italic text-primary-dark">
                  {num}
                </span>
                <div>
                  <h3 className="font-heading text-xl">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ░░ DÉSIR — COLLECTION ░░ */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
          <div className="mb-12 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-primary-dark">
                Les plus désirées
              </p>
              <h2 className="mt-2 font-heading text-4xl md:text-5xl">
                Nos produits phares
              </h2>
            </div>
            <Link
              href="/products"
              className="hidden whitespace-nowrap text-sm font-medium text-ink underline-offset-4 hover:text-primary-dark hover:underline sm:block"
            >
              Tout voir →
            </Link>
          </div>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 3) * 80}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
          <div className="mt-12 text-center sm:hidden">
            <Link
              href="/products"
              className="inline-block rounded-full bg-ink px-8 py-3.5 text-sm font-medium text-bg hover:bg-primary-dark"
            >
              Voir toute la collection
            </Link>
          </div>
        </div>
      </section>

      {/* ░░ DÉSIR — NOTRE HISTOIRE ░░ */}
      <section id="histoire" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
          <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center">
            <Reveal>
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-primary-dark">
                Notre histoire
              </p>
              <h2 className="mt-2 font-heading text-4xl md:text-5xl">
                L&apos;histoire qui donne envie d&apos;acheter ici
              </h2>
              <div className="mt-6 space-y-4 leading-relaxed text-muted">
                <p>
                  Le récit de fondation : d&apos;où vient la marque, quel
                  problème elle a voulu régler, pourquoi elle existe. C&apos;est
                  la section qui transforme un vendeur anonyme en quelqu&apos;un
                  à qui on fait confiance.
                </p>
                <p>
                  Un deuxième paragraphe sur la façon de travailler
                  aujourd&apos;hui. Rester concret : une histoire vraie et
                  banale convainc mieux qu&apos;une légende trop lisse.
                </p>
              </div>
              <div className="mt-8 flex gap-10">
                {[
                  ["20XX", "Année de création"],
                  ["00", "Références au catalogue"],
                  ["100%", "Argument chiffré"],
                ].map(([v, k]) => (
                  <div key={k}>
                    <p className="font-heading text-2xl">{v}</p>
                    <p className="text-xs uppercase tracking-wider text-muted">
                      {k}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
            <div className="relative">
              <div className="absolute -left-8 -top-8 h-56 w-56 animate-glow rounded-full bg-halo blur-3xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/demo-un-2.svg"
                alt="Univers de la marque"
                loading="lazy"
                className="relative z-10 aspect-[4/5] w-full rounded-[2rem] object-cover shadow-soft"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ░░ DÉSIR — SAVOIR-FAIRE ░░ */}
      <section id="savoir-faire" className="scroll-mt-20 bg-ink text-bg">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 md:grid-cols-2 md:py-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/products/demo-deux-1.svg"
            alt="Savoir-faire de la marque"
            loading="lazy"
            className="aspect-square w-full rounded-[2rem] object-cover"
          />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-halo">
              Savoir-faire
            </p>
            <h2 className="mt-3 font-heading text-4xl text-bg md:text-5xl">
              Comment c&apos;est fabriqué
            </h2>
            <p className="mt-6 leading-relaxed text-bg/70">
              Le procédé, en langage simple. Cette section justifie le prix :
              plus elle est précise et technique, plus elle travaille pour vous.
            </p>
            <div className="mt-8 space-y-5">
              {[
                ["01", "Première étape", "Ce qui est choisi, et selon quel critère."],
                ["02", "Deuxième étape", "Le geste ou le contrôle qui fait la différence."],
                ["03", "Troisième étape", "Ce qui est vérifié avant l'expédition."],
              ].map(([n, t, d]) => (
                <div key={n} className="flex gap-5 border-t border-bg/15 pt-5">
                  <span className="font-heading text-2xl text-halo">{n}</span>
                  <div>
                    <p className="font-medium text-bg">{t}</p>
                    <p className="text-sm text-bg/60">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ░░ DÉSIR — AVIS (éditorial) ░░ */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <Reveal className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <Stars className="text-lg" />
            <span className="font-heading text-2xl">0,0/5</span>
          </div>
          <p className="mt-2 text-sm text-muted">
            Note réelle à renseigner — voir l&apos;avertissement ci-dessous
          </p>
        </Reveal>

        <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-3">
          {[
            // ⚠️ Des avis inventés sur une boutique en ligne sont une pratique
            // commerciale trompeuse (art. L121-2 du code de la consommation).
            // À remplacer par de VRAIS retours clients, ou à supprimer.
            [
              "Premier avis client — le verbatim brut convainc davantage qu'une phrase réécrite.",
              "Prénom N.",
              "Qualité ou ville",
            ],
            [
              "Deuxième avis — celui qui lève une objection précise (le prix, la taille, le délai).",
              "Prénom N.",
              "Qualité ou ville",
            ],
            [
              "Troisième avis — celui qui parle de la livraison et du service après-vente.",
              "Prénom N.",
              "Qualité ou ville",
            ],
          ].map(([quote, name, role], i) => (
            <Reveal
              key={name}
              delay={i * 90}
              className="border-t border-line pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0 md:[&:first-child]:border-l-0 md:[&:first-child]:pl-0"
            >
              <span className="font-heading text-5xl leading-none text-primary/40">
                &ldquo;
              </span>
              <p className="mt-1 leading-relaxed text-ink/85">{quote}</p>
              <p className="mt-6 text-sm font-medium">{name}</p>
              <p className="text-xs text-muted">{role}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ░░ ACTION — CTA DE CLÔTURE (éditorial) ░░ */}
      <section className="border-y border-line bg-ink text-bg">
        <Reveal className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 md:py-28">
          <span className="mx-auto block h-px w-10 bg-primary" />
          <h2 className="mt-8 font-heading text-4xl leading-tight text-bg md:text-5xl">
            La dernière invitation à passer commande.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-bg/60">
            Rappeler ici les garanties qui lèvent le frein final : livraison,
            délai de retour, paiement sécurisé.
          </p>
          <Link
            href="/products"
            className="mt-9 inline-block rounded-full bg-primary px-9 py-4 text-sm font-medium text-ink transition-all duration-300 hover:scale-[0.98] hover:bg-halo"
          >
            Voir la collection
          </Link>
        </Reveal>
      </section>

      {/* ░░ NEWSLETTER ░░ */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="rounded-[2.5rem] border border-line bg-secondary/10 px-6 py-14 text-center md:px-16">
          <h2 className="font-heading text-2xl md:text-3xl">
            Rejoignez la newsletter
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Ce qu&apos;on y reçoit, et pourquoi ça vaut une adresse e-mail.
            ⚠️ Ce formulaire n&apos;est PAS branché : il faut encore le relier
            à un service d&apos;e-mailing.
          </p>
          <form className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              placeholder="Votre adresse e-mail"
              className="flex-1 rounded-full border border-line bg-surface px-5 py-3.5 text-sm outline-none transition focus:border-primary"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-bg transition hover:bg-primary-dark"
            >
              S&apos;inscrire
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
