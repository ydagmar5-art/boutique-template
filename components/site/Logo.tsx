import Link from "next/link";
import { brand } from "@/config/brand.config";

/**
 * Logo NEUTRE du modèle : le nom de la marque seul, en capitales espacées.
 *
 * ⚠️ Le modèle portait le monogramme M+R et la mention « PARIS » de Maison
 * Romy Paris : ils survivaient sur chaque nouvelle boutique (Casa Pilates,
 * novembre 2026). Ne rien remettre ici qui appartienne à une autre marque, ni
 * ville sous le nom : une ville affichée vaut indication d'établissement, et
 * Merchant Center comme les prestataires de paiement la comparent au
 * titulaire du compte.
 *
 * Pour un pictogramme propre à la boutique : le dessiner en SVG à gauche du
 * nom (`currentColor`, net à toute taille), et reprendre le même tracé dans
 * `app/icon.svg` pour le favicon.
 *
 * ⚠️ Conserver le `<Link href="/">` et le `aria-label` : c'est le retour à
 * l'accueil sur toutes les pages, et le seul repère des lecteurs d'écran.
 */
export default function Logo({ tone = "ink" }: { tone?: "ink" | "light" }) {
  return (
    <Link
      href="/"
      aria-label={`${brand.name} — accueil`}
      className={`inline-flex items-center ${tone === "light" ? "text-bg" : "text-ink"}`}
    >
      <span className="font-heading text-[0.8rem] font-normal leading-none tracking-[0.3em] sm:text-sm">
        {brand.name}
      </span>
    </Link>
  );
}
