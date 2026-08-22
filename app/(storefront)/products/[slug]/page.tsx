import type { Metadata } from "next";
import { brand } from "@/config/brand.config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { seedProducts } from "@/lib/products";
import { reviews, averageRating } from "@/lib/reviews";
import SecuriteProduit from "@/components/shop/SecuriteProduit";
import { getVisibleProduct, listVisibleProducts } from "@/lib/actions/products";
import { getStorefrontSettings } from "@/lib/actions/storefront";
import AddToCart from "@/components/shop/AddToCart";
import ProductGallery from "@/components/shop/ProductGallery";
import ProductCard from "@/components/shop/ProductCard";
import Reassurances from "@/components/site/Reassurances";
import PaymentBadges from "@/components/site/PaymentBadges";
import FrenchMark from "@/components/site/FrenchMark";
import OfferFilm from "@/components/site/OfferFilm";
import MaisonSection from "@/components/site/MaisonSection";
import JsonLd from "@/components/site/JsonLd";
import { ligneDuProduit } from "@/lib/collections";
import {
  absolu,
  descriptionProduit,
  titreProduit,
  filArianeJsonLd,
  produitJsonLd,
} from "@/lib/seo";

export const dynamicParams = true;

export function generateStaticParams() {
  return seedProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getVisibleProduct(slug);
  if (!product) return { title: "Produit introuvable" };

  /*
    ⚠️ La description était le `tagline` seul — 25 caractères là où Google en
    affiche 155, soit une ligne quasi vide dans les résultats. On compose
    matière, format et livraison, tous tirés du catalogue : rien d'inventé.

    ⚠️ La canonique est indispensable ici : chaque fiche est atteinte par 5 à
    8 adresses différentes depuis Pinterest (`?utm_source=…&utm_content=…`).
    Sans elle, Google voit autant de pages dupliquées que d'épingles.
  */
  const description = descriptionProduit(product);
  const titre = titreProduit(product);
  return {
    title: titre,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${titre} | ${brand.name}`,
      description,
      url: absolu(`/products/${product.slug}`),
      images: product.images.slice(0, 1).map((img) => ({
        url: img,
        width: 896,
        height: 1200,
        alt: product.name,
      })),
    },
    twitter: {
      card: "summary_large_image",
      title: `${titre} | ${brand.name}`,
      description,
      images: product.images.slice(0, 1),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, reglages, catalogue] = await Promise.all([
    getVisibleProduct(slug),
    getStorefrontSettings(),
    listVisibleProducts(),
  ]);
  if (!product) notFound();

  /*
    ── Maillage interne ──
    Une visiteuse arrivée de Pinterest sur une fiche n'avait aucun chemin vers
    le reste du catalogue : l'ancienne page était un cul-de-sac, pour elle
    comme pour l'exploration de Google. On propose la même ligne d'abord —
    c'est aussi la seconde pièce de l'offre à −40 %.

    ⚠️ On garde l'ORDRE du catalogue, sans tri : le gérant l'a réglé à la main
    dans le back-office (cf. HANDOFF §2).
  */
  const memeLigne = catalogue.filter(
    (p) => p.collection === product.collection && p.slug !== product.slug,
  );
  const autres = catalogue.filter(
    (p) => p.collection !== product.collection && p.slug !== product.slug,
  );
  const suggestions = [...memeLigne, ...autres].slice(0, 4);
  const ligne = ligneDuProduit(product.collection);

  // Avis affichés sur la fiche : ceux qui citent ce modèle en priorité,
  // complétés par les plus élogieux. La note reste celle de TOUS les avis —
  // afficher la moyenne d'une sélection choisie serait une note truquée.
  const note = averageRating();
  const cites = reviews.filter((r) => r.slug === product.slug);
  const avis = [...cites, ...reviews.filter((r) => !cites.includes(r))].slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 md:py-16">
      {/*
        ⚠️ `cites` et non `avis` : seuls les avis qui citent CE modèle
        alimentent la note balisée. Appliquer la moyenne du site à une fiche
        qui n'a reçu aucun avis est précisément ce que Google sanctionne — et
        ce serait mentir à la cliente.
      */}
      <JsonLd donnees={produitJsonLd(product, cites)} />
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: "Accueil", url: "/" },
          { nom: "La collection", url: "/products" },
          ...(ligne ? [{ nom: ligne.h1, url: `/collections/${ligne.slug}` }] : []),
          { nom: product.name, url: `/products/${product.slug}` },
        ])}
      />

      {/* Le fil passe par la LIGNE : c'est ce qui fait remonter le jus des
          fiches vers les pages de catégorie, celles qui visent les termes
          réellement cherchés. */}
      <nav className="mb-8 text-sm text-muted">
        <Link href="/products" className="hover:text-ink">
          Collection
        </Link>
        {ligne && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/collections/${ligne.slug}`} className="hover:text-ink">
              {ligne.h1}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-12 md:grid-cols-2">
        {/* Galerie */}
        <ProductGallery images={product.images} name={product.name} />

        {/* Infos */}
        <div className="md:py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted">
              {product.collection}
            </span>
            <FrenchMark />
          </div>
          <h1 className="mt-4 font-heading text-4xl font-light md:text-5xl">
            {product.name}
          </h1>
          <p className="mt-2 text-muted">{product.tagline}</p>

          {/*
            Le modèle affichait ici 5 étoiles et « Coup de cœur des clients »
            sur TOUS les produits. Retiré : une note affichée sans avis réel
            est une pratique commerciale trompeuse (art. L121-2 du code de la
            consommation). À remettre quand de vrais avis seront collectés.
          */}

          <p className="mt-7 leading-relaxed text-ink/80">
            {product.description}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-y-4 border-y border-line py-6 text-sm">
            <dt className="text-muted">Matières</dt>
            <dd className="text-right">{product.material}</dd>
            <dt className="text-muted">{brand.productDetailLabel}</dt>
            <dd className="text-right">{product.detail}</dd>
          </dl>

          <div className="mt-8">
            <AddToCart product={product} />
          </div>

          {/*
            Moyens de paiement acceptés, centrés juste sous les boutons.
            La mention « Paiement sécurisé : » qui les précédait a été
            retirée : elle faisait doublon avec la réassurance du même nom,
            trois centimètres plus bas.
          */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <PaymentBadges />
          </div>

          {/* Rappel de l'offre à l'endroit qui compte : au moment où la
              cliente décide. */}
          {/* ⚠️ Affiché SEULEMENT si une offre existe. Sans ce garde, une
              boutique sans promotion montrait un cadre vide surmontant
              « Appliquée automatiquement au panier » — une promesse de remise
              qui n'existe pas. */}
          {brand.offer.short && (
            <p className="mt-5 border border-line px-4 py-3 text-center text-[0.68rem] leading-relaxed text-muted">
              <span className="text-ink">{brand.offer.short}</span>
              <br />
              Appliquée automatiquement au panier.
            </p>
          )}

          {/* Réassurances */}
          <div className="mt-8">
            <Reassurances variant="compact" />
          </div>
        </div>
      </div>

      {/*
        ░░ RÉCIT ░░
        Volontairement APRÈS la fiche technique, le prix et les réassurances :
        on ne raconte une histoire qu'une fois l'objection rationnelle levée.
        Le contenu vient de `product.story`, éditable dans le back-office ;
        la section disparaît si le champ est vide.
      */}
      {product.story && (
        <section className="mt-14 border-t border-line md:mt-28">
          <div className="mx-auto grid max-w-5xl gap-6 py-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-20">
            <div>
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
                Le mot de la maison
              </p>
              <h2 className="mt-4 font-heading text-2xl font-light leading-tight md:text-[2rem]">
                {product.story.title}
              </h2>
            </div>
            <p className="text-[1.02rem] leading-[1.85] text-muted">
              {product.story.body}
            </p>
          </div>
        </section>
      )}

      {/*
        ░░ LA MAISON ░░
        Le même bloc que sur l'accueil, rédigé depuis le tableau de bord.

        Placé JUSTE AVANT l'offre : la cliente vient de lire la fiche et le
        récit du modèle ; on lui dit qui est derrière avant de lui proposer
        une seconde pièce. Une remise pèse davantage quand on sait à qui on
        a affaire.

        ⚠️ SANS `ancre` : `id="maison"` est la cible du menu et ne doit
        exister qu'une fois par page — ici le lien du menu doit continuer de
        renvoyer vers l'accueil.

        Pleine largeur, comme l'offre : le composant porte son propre
        conteneur centré, les marges négatives annulent le `px-5 sm:px-8`
        de la fiche.
      */}
      <div className="-mx-5 border-t border-line sm:-mx-8">
        <MaisonSection maison={reglages.maison} />
      </div>

      {/*
        ░░ L'OFFRE ░░
        En pleine largeur, hors du conteneur de la fiche : le film doit
        toucher les deux bords de l'écran. D'où les marges négatives, qui
        annulent le `px-5 sm:px-8` du parent.
      */}
      {/* ⚠️ Masqué tant qu'aucune offre n'est configurée : sans ce garde, le
          film s'affichait avec un sur-titre, un titre et un sous-titre VIDES,
          soit une grande bande muette au milieu de la fiche. */}
      {brand.offer.title && (
      <div className="-mx-5 mt-14 sm:-mx-8 md:mt-20">
        <OfferFilm
          cta="Ajouter une seconde pièce"
          deadline={reglages.offerDeadline}
        />
      </div>
      )}

      {/* ░░ AVIS ░░ */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl py-16 md:py-20">
          <div className="mb-12 flex flex-wrap items-center justify-center gap-3">
            <span
              className="tracking-[0.15em] text-ink"
              aria-label={`${note} sur 5`}
            >
              {"★".repeat(Math.round(note))}
              <span className="text-border">
                {"★".repeat(5 - Math.round(note))}
              </span>
            </span>
            <span className="text-[0.72rem] text-muted">
              {note.toString().replace(".", ",")} sur 5 — avis vérifiés
            </span>
          </div>
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
            {avis.map((r) => (
              <div key={r.author + r.title} className="border-t border-line pt-6">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink">
                  {r.title}
                </p>
                <p className="mt-3 text-sm leading-[1.75] text-muted">{r.body}</p>
                <p className="mt-4 text-[0.68rem] uppercase tracking-[0.16em] text-muted">
                  {r.author}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ░░ DANS LA MÊME LIGNE ░░ */}
      {suggestions.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl py-16 md:py-20">
            <h2 className="mb-10 font-heading text-2xl font-light">
              Dans la ligne {product.collection}
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {suggestions.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
            <Link
              href="/products"
              className="mt-12 inline-block border-b border-ink pb-1 text-[0.72rem] uppercase tracking-[0.16em] text-ink hover:opacity-60"
            >
              Voir toute la collection
            </Link>
          </div>
        </section>
      )}

      {/* Sécurité et conformité — règlement (UE) 2023/988.
          ⚠️ Ne s'affiche que si `lib/securite-produit.ts` est renseigné : la
          section reste invisible tant que le fabricant et le responsable
          établi dans l'Union ne sont pas connus. Obligation légale pour toute
          vente à distance dans l'Union — un lien vers une autre page ne
          satisfait PAS l'article 19. */}
      <SecuriteProduit />

    </div>
  );
}
