import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ARTICLES, tempsLecture } from "@/lib/blog";
import JsonLd from "@/components/site/JsonLd";
import { absolu, filArianeJsonLd } from "@/lib/seo";
import { brand } from "@/config/brand.config";

export const metadata: Metadata = {
  title: "Blog — choisir, porter et entretenir un sac",
  description:
    "Mes articles pour choisir un sac à main, reconnaître un cuir de " +
    "qualité et entretenir une pièce pour qu'elle dure.",
  alternates: { canonical: "/blog" },
};

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: "Accueil", url: "/" },
          { nom: "Blog", url: "/blog" },
        ])}
      />
      <JsonLd
        donnees={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `Blog ${brand.name}`,
          url: absolu("/blog"),
          inLanguage: brand.locale,
          publisher: { "@type": "Organization", name: brand.name },
          blogPost: ARTICLES.map((a) => ({
            "@type": "BlogPosting",
            headline: a.titre,
            description: a.description,
            url: absolu(`/blog/${a.slug}`),
            datePublished: a.publieLe,
            dateModified: a.majLe,
          })),
        }}
      />

      <h1 className="font-heading text-4xl font-light md:text-5xl">Blog</h1>
      <p className="mt-6 max-w-xl text-sm leading-[1.85] text-muted">
        Choisir une pièce, la porter, la garder. Ce que nous regardons nous-mêmes
        avant de retenir un modèle, et les questions que vous me posez le plus
        souvent.
      </p>

      {/* Grille : le visuel porte autant que le titre sur une page de blog. */}
      <ul className="mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {ARTICLES.map((a, i) => (
          <li key={a.slug}>
            <Link href={`/blog/${a.slug}`} className="group flex h-full flex-col">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                <Image
                  src={a.image}
                  alt={a.imageAlt}
                  fill
                  /* Les deux premières vignettes sont au-dessus de la ligne de
                     flottaison : on les charge sans attendre. */
                  priority={i < 2}
                  sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-5 text-[0.64rem] uppercase tracking-[0.2em] text-muted">
                <time dateTime={a.publieLe}>{dateFr(a.publieLe)}</time>
                <span className="mx-2">·</span>
                {tempsLecture(a)} min
              </p>
              <h2 className="mt-2.5 font-heading text-[1.35rem] font-light leading-snug transition-opacity group-hover:opacity-60">
                {a.titre}
              </h2>
              <p className="mt-2.5 text-sm leading-[1.75] text-muted">
                {a.description}
              </p>
              <span className="mt-4 inline-block self-start border-b border-ink pb-0.5 text-[0.68rem] uppercase tracking-[0.18em] text-ink">
                Lire l&apos;article
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
