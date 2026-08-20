"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand.config";
import { useCart, cartCount } from "@/lib/cart/store";
import Logo from "./Logo";

/**
 * ⚠️ CORRECTIF À FAIRE REDESCENDRE DANS LE MODÈLE.
 *
 * La version d'origine posait `hidden md:flex` sur la navigation SANS prévoir
 * de menu mobile : sous 768 px, les liens n'étaient donc atteignables par
 * aucun moyen — ni bouton, ni tiroir. Le défaut est invisible au
 * développement (on travaille en grand écran) et coûte cher en production,
 * où l'essentiel du trafic est mobile. Toute boutique clonée avant ce
 * correctif a le trou.
 */
export default function Navbar() {
  const lines = useCart((s) => s.lines);
  const open = useCart((s) => s.open);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Échappement : une issue au clavier est exigée dès qu'un panneau se
  // superpose au contenu.
  useEffect(() => {
    if (!menuOuvert) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOuvert(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOuvert]);

  const count = mounted ? cartCount(lines) : 0;

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled || menuOuvert
          ? "border-b border-line bg-bg/85 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {brand.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={open}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink transition-all hover:border-primary hover:shadow-glow"
          >
            Panier
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium transition-colors ${
                count > 0 ? "bg-primary text-white" : "bg-bg text-muted"
              }`}
            >
              {count}
            </span>
          </button>

          {/* Bouton de menu — mobile uniquement. 44 × 44 px minimum : c'est le
              seuil tactile sous lequel les erreurs de visée explosent. */}
          <button
            type="button"
            onClick={() => setMenuOuvert((v) => !v)}
            aria-expanded={menuOuvert}
            aria-controls="menu-mobile"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-halo md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              {menuOuvert ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M3.5 7h17" />
                  <path d="M3.5 12h17" />
                  <path d="M3.5 17h17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Panneau mobile. Rendu conditionnel plutôt que masqué en CSS : un
          panneau seulement caché garderait ses liens dans l'ordre de
          tabulation, et le clavier se perdrait dedans. */}
      {menuOuvert && (
        <nav
          id="menu-mobile"
          className="border-t border-line bg-bg md:hidden"
          aria-label="Navigation principale"
        >
          <ul className="mx-auto max-w-6xl px-5 py-2 sm:px-8">
            {brand.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOuvert(false)}
                  className="block border-b border-line py-4 text-[1.05rem] font-semibold text-ink transition-colors last:border-b-0 hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
