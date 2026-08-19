import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ARTICLES, articleParSlug, tempsLecture } from "@/lib/blog";
import { LIGNES } from "@/lib/collections";
import JsonLd from "@/components/site/JsonLd";
import { absolu, filArianeJsonLd } from "@/lib/seo";
import { brand } from "@/config/brand.config";
import { listVisibleProducts } from "@/lib/actions/products";
import ProductCard from "@/components/shop/ProductCard";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = articleParSlug(slug);
  if (!a) return { title: "Article introuvable" };
  return {
    title: a.titreSeo,
    description: a.description,
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: {
      type: "article",
      title: `${a.titre} | ${brand.name}`,
      description: a.description,
      url: absolu(`/blog/${a.slug}`),
      publishedTime: a.publieLe,
      modifiedTime: a.majLe,
      images: [{ url: a.image, width: 896, height: 1200, alt: a.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${a.titre} | ${brand.name}`,
      description: a.description,
      images: [a.image],
    },
  };
}

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = articleParSlug(slug);
  if (!a) notFound();

  const lignes = a.lignes
    .map((s) => LIGNES.find((l) => l.slug === s))
    .filter((l): l is (typeof LIGNES)[number] => Boolean(l));
  const autres = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 2);

  /*
    Rappel produits — l'article amène du trafic, encore faut-il lui donner
    une porte de sortie vers la boutique. On prend les modèles de la
    PREMIÈRE ligne citée, en passant par `listVisibleProducts` : un modèle
    masqué au back-office ne doit jamais apparaître ici.
  */
  const catalogue = await listVisibleProducts();
  const ligneCta = lignes[0];
  const produitsCta = ligneCta
    ? catalogue.filter((p) => p.collection === ligneCta.nom).slice(0, 3)
    : [];

  return (
    <article className="mx-auto max-w-[46rem] px-5 py-14 sm:px-8 md:py-20">
      <JsonLd
        donnees={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: a.titre,
          description: a.description,
          inLanguage: brand.locale,
          mainEntityOfPage: absolu(`/blog/${a.slug}`),
          image: absolu(a.image),
          datePublished: a.publieLe,
          dateModified: a.majLe,
          author: { "@type": "Organization", name: brand.name, url: absolu("/") },
          publisher: { "@type": "Organization", name: brand.name, url: absolu("/") },
        }}
      />
      {/*
        ⚠️ `FAQPage` n'est posé que parce que les questions ci-dessous sont
        RÉELLEMENT affichées sur la page, avec leur réponse. Un balisage qui
        ne correspond pas au contenu visible est une manipulation.
      */}
      <JsonLd
        donnees={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: a.faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.reponse },
          })),
        }}
      />
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: "Accueil", url: "/" },
          { nom: "Blog", url: "/blog" },
          { nom: a.titre, url: `/blog/${a.slug}` },
        ])}
      />

      <nav className="mb-10 text-sm text-muted">
        <Link href="/blog" className="hover:text-ink">
          Blog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{a.titre}</span>
      </nav>

      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-muted">
        <time dateTime={a.publieLe}>{dateFr(a.publieLe)}</time>
        <span className="mx-2">·</span>
        {tempsLecture(a)} min de lecture
      </p>

      <h1 className="mt-5 font-heading text-4xl font-light leading-[1.1] md:text-[3.25rem]">
        {a.titre}
      </h1>

      {/*
        ── LE BLOC QUI SE FAIT CITER ──
        Réponse autonome, placée haut, sans vocabulaire de marque. C'est ce
        qu'un assistant extrait quand on lui pose la question, et c'est aussi
        ce qu'une lectrice pressée vient chercher.
      */}
      <div className="mt-10 border-l-2 border-ink bg-surface px-6 py-6 md:px-8">
        <p className="text-[0.68rem] uppercase tracking-[0.2em] text-muted">
          En bref
        </p>
        <p className="mt-3 text-base leading-[1.8] text-ink">{a.reponseCourte}</p>
      </div>

      <p className="mt-10 text-base leading-[1.9] text-muted">{a.chapeau}</p>

      <figure className="mt-12">
        <div className="relative aspect-[16/10] overflow-hidden bg-surface">
          <Image
            src={a.image}
            alt={a.imageAlt}
            fill
            priority
            sizes="(min-width: 768px) 46rem, 100vw"
            className="object-cover"
          />
        </div>
      </figure>

      {a.sections.map((s) => (
        <section key={s.titre} className="mt-14">
          <h2 className="font-heading text-2xl font-light leading-snug">
            {s.titre}
          </h2>
          {s.paragraphes.map((p) => (
            <p key={p.slice(0, 24)} className="mt-4 text-[0.95rem] leading-[1.9] text-muted">
              {p}
            </p>
          ))}
          {s.image && (
            <figure className="mt-8">
              <div className="relative aspect-[16/10] overflow-hidden bg-surface">
                <Image
                  src={s.image}
                  alt={s.imageAlt ?? ""}
                  fill
                  sizes="(min-width: 768px) 46rem, 100vw"
                  className="object-cover"
                />
              </div>
            </figure>
          )}
          {s.liste && (
            <ul className="mt-6 space-y-2.5">
              {s.liste.map((li) => (
                <li
                  key={li}
                  className="flex gap-3 text-[0.95rem] leading-[1.7] text-muted"
                >
                  <span aria-hidden className="mt-[0.6em] h-px w-4 shrink-0 bg-ink" />
                  <span>{li}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* ── Questions fréquentes ── */}
      <section className="mt-20 border-t border-line pt-12">
        <h2 className="font-heading text-2xl font-light">Questions fréquentes</h2>
        <dl className="mt-8 space-y-8">
          {a.faq.map((f) => (
            <div key={f.question}>
              <dt className="text-[0.95rem] font-medium text-ink">{f.question}</dt>
              <dd className="mt-2.5 text-[0.95rem] leading-[1.85] text-muted">
                {f.reponse}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Appel à la boutique ── */}
      {produitsCta.length > 0 && ligneCta && (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="font-heading text-2xl font-light">
            {ligneCta.h1} — nos modèles
          </h2>
          <p className="mt-3 text-sm leading-[1.8] text-muted">
            {ligneCta.description}
          </p>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3">
            {produitsCta.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
          <Link
            href={`/collections/${ligneCta.slug}`}
            className="mt-10 inline-block bg-ink px-8 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-bg transition-opacity hover:opacity-80"
          >
            Voir tous les {ligneCta.h1.toLowerCase()}
          </Link>
        </section>
      )}

      {/* ── Maillage : lignes puis autres articles ── */}
      <aside className="mt-16 border-t border-line pt-10">
        <h2 className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
          À voir dans la collection
        </h2>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {lignes.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/collections/${l.slug}`}
                className="border-b border-ink pb-0.5 text-sm text-ink hover:opacity-60"
              >
                {l.h1}
              </Link>
            </li>
          ))}
        </ul>

        {autres.length > 0 && (
          <>
            <h2 className="mt-12 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
              À lire ensuite
            </h2>
            <ul className="mt-5 space-y-3">
              {autres.map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/blog/${x.slug}`}
                    className="text-sm text-ink hover:opacity-60"
                  >
                    {x.titre}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </article>
  );
}
