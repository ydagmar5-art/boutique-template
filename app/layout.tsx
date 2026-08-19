import type { Metadata } from "next";
import { brand, brandCssVars } from "@/config/brand.config";
import { fontVariables } from "@/config/fonts";
import "./globals.css";

/**
 * Interrupteur de référencement.
 *
 * ⚠️ ACTIF (`NOINDEX=1`) uniquement pendant les phases où le site ne doit pas
 * être indexé : avant d'avoir son domaine, ou tant que les mentions légales
 * ne sont pas celles de son propre exploitant. Laisser un moteur indexer une
 * information légale fausse la met en cache, et le cache survit à la
 * correction.
 *
 * Le référencement est OUVERT depuis que l'exploitant figure dans
 * `brand.legal` et que le domaine est branché : la variable a été retirée du
 * projet Vercel. La remettre à "1" pour rebasculer en préproduction.
 */
const noindex = process.env.NOINDEX === "1";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";

export const metadata: Metadata = {
  /*
    ⚠️ `metadataBase` conditionne TOUT le reste : sans lui, Next.js émet des
    URL relatives dans les balises canoniques et Open Graph, que ni Google ni
    les réseaux sociaux ne savent résoudre. Les `alternates.canonical` posés
    page par page en dépendent.
  */
  ...(SITE ? { metadataBase: new URL(SITE) } : {}),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  /*
    Open Graph : sans ces balises, un lien partagé sur WhatsApp, Messenger ou
    Pinterest sort sans image ni titre. Pinterest relit d'ailleurs la page
    pour enrichir les épingles — c'est directement le canal qu'on vient de
    monter. Chaque page peut surcharger ce socle (la fiche produit le fait
    avec sa propre photo).
  */
  openGraph: {
    type: "website",
    siteName: brand.name,
    locale: brand.locale.replace("-", "_"),
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    ...(SITE ? { url: SITE } : {}),
    images: [
      {
        // 1200×630 : le format attendu par Facebook, WhatsApp, LinkedIn et
        // Slack. Le poster du film, en 720×960, se faisait recadrer de
        // travers sur la moitié d'entre eux.
        url: "/og/default.jpg",
        width: 1200,
        height: 630,
        alt: `${brand.name} — ${brand.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    images: ["/og/default.jpg"],
  },
  ...(noindex
    ? { robots: { index: false, follow: false, nocache: true } }
    : {
        // Autorise explicitement les grands aperçus d'image, sans quoi Google
        // se limite parfois à une vignette dans Discover et Google Images.
        robots: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      }),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={brand.locale.split("-")[0]} className={fontVariables}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCssVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
