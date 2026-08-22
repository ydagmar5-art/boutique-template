import Link from "next/link";
import GererCookies from "./GererCookies";
import { brand } from "@/config/brand.config";
import Logo from "./Logo";
import PaymentBadges from "./PaymentBadges";
import FrenchMark from "./FrenchMark";

/**
 * ⚠️ PAS de marge supérieure sur le `<footer>` — ne pas remettre `mt-24`.
 * Elle produisait une bande blanche de 96 px entre le footer et les pages
 * qui se terminent par un visuel pleine largeur (accueil, fiche produit).
 * Les pages de texte qui ont besoin d'air la posent elles-mêmes, en bas de
 * leur propre contenu : c'est à la page de décider de sa respiration, pas au
 * footer de l'imposer à toutes.
 */
export default function Footer() {
  return (
    <footer className="border-t border-line bg-ink text-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-bg/60">
            {brand.description}
          </p>
          {/* Sur fond sombre : le filet de contour du drapeau suit
              `currentColor`, d'où `text-bg` pour qu'il reste visible. */}
          <FrenchMark className="mt-5 text-bg" />
        </div>
        <div>
          <h4 className="mb-4 text-sm font-medium text-halo">Boutique</h4>
          <ul className="space-y-2 text-sm text-bg/60">
            {brand.nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="transition-colors hover:text-bg">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-medium text-halo">Informations</h4>
          <ul className="space-y-2 text-sm text-bg/60">
            {/*
              ⚠️ Contact et Livraison figurent en TÊTE : ce sont les deux pages
              qu'un prestataire de paiement cherche en premier lors de
              l'examen du site, et les deux qu'une cliente cherche avant
              d'acheter. Ne pas les enfouir sous les pages juridiques.
            */}
            <li>
              <Link href="/contact" className="transition-colors hover:text-bg">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/livraison" className="transition-colors hover:text-bg">
                Livraison
              </Link>
            </li>
            <li>
              <Link href="/blog" className="transition-colors hover:text-bg">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/mentions-legales" className="transition-colors hover:text-bg">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/cgv" className="transition-colors hover:text-bg">
                CGV
              </Link>
            </li>
            <li>
              <Link href="/cgu" className="transition-colors hover:text-bg">
                CGU
              </Link>
            </li>
            <li>
              <Link href="/remboursement" className="transition-colors hover:text-bg">
                Rétractation &amp; remboursement
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className="transition-colors hover:text-bg">
                Confidentialité
              </Link>
            </li>
            <li>
              {/* Révocation du consentement — art. 7.3 du RGPD. */}
              <GererCookies className="transition-colors hover:text-bg" />
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-medium text-halo">Contact</h4>
          <ul className="space-y-2 text-sm text-bg/60">
            <li>
              <a href={`mailto:${brand.contact.email}`} className="transition-colors hover:text-bg">
                {brand.contact.email}
              </a>
            </li>
            {brand.contact.phone && <li>{brand.contact.phone}</li>}
            <li>{brand.contact.city}</li>
            <li className="flex gap-4 pt-2">
              {brand.social.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className="transition-colors hover:text-bg"
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.label}
                </a>
              ))}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-bg/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-6 sm:px-8">
          <PaymentBadges />
          <p className="text-xs text-bg/40">
            Paiement 100 % sécurisé · {brand.shippingNote}
          </p>
        </div>
      </div>
      <div className="border-t border-bg/10">
        {/*
          ⚠️ Raison sociale, numéro d'immatriculation et siège en pied de PAGE,
          sur toutes les pages : c'est ce que cherche un examinateur de compte
          de paiement en premier, et il ne va pas toujours jusqu'aux mentions
          légales. L'identité affichée doit correspondre EXACTEMENT au
          titulaire du compte.
        */}
        <div className="mx-auto max-w-6xl px-5 py-5 text-center text-xs leading-relaxed text-bg/40 sm:px-8">
          {/* ⚠️ NE JAMAIS RAJOUTER DE VILLE ICI. Le modèle d'origine venait
              d'une maison parisienne et la mention « PARIS » a survécu à
              plusieurs reprises, jusqu'à affirmer un établissement en France
              pour une société immatriculée à l'étranger. C'est une fausse
              indication d'établissement — et le premier écart que relèvent
              Merchant Center et les prestataires de paiement, qui comparent
              le pied de page au titulaire du compte. */}
          © {new Date().getFullYear()} {brand.name}. Tous droits réservés.
          <br />
          {brand.legal.operator} — {brand.legal.registry.split(",")[0]} n°{" "}
          {brand.legal.registrationNumber} — {brand.legal.address}
        </div>
      </div>
    </footer>
  );
}
