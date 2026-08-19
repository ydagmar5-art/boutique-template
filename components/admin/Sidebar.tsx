"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { brand } from "@/config/brand.config";

const nav = [
  { label: "Tableau de bord", href: "/admin", icon: "▤" },
  { label: "Statistiques", href: "/admin/stats", icon: "◔" },
  { label: "Commandes", href: "/admin/orders", icon: "▥" },
  { label: "Catalogue", href: "/admin/products", icon: "▦" },
  { label: "Catégories", href: "/admin/categories", icon: "▤" },
  { label: "Clients", href: "/admin/customers", icon: "▧" },
  { label: "Contacts & export", href: "/admin/contacts", icon: "◫" },
  { label: "Offres & codes promo", href: "/admin/promotions", icon: "◇" },
  { label: "Passerelles de paiement", href: "/admin/payments", icon: "▨" },
  { label: "Pixels & tracking", href: "/admin/pixels", icon: "◈" },
];

/**
 * Navigation du back-office.
 *
 * ⚠️ Sur MOBILE, elle se replie en tiroir : la version d'origine était une
 * colonne fixe de 240 px qui, sur un écran de 375 px, ne laissait que 135 px
 * au contenu — tableaux et graphiques devenaient illisibles.
 *
 * Le tiroir se referme à chaque changement de page : sans ça, on cliquait un
 * lien et on restait devant le menu, persuadé que rien ne s'était passé.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  return (
    <>
      {/* Barre mobile : le tiroir n'existe qu'en dessous de `lg`. */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <span className="font-heading text-base tracking-[0.2em]">
          {brand.name}
        </span>
        <button
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink"
        >
          {ouvert ? "Fermer" : "Menu"}
        </button>
      </div>

      {/* Voile : ferme le tiroir au toucher, hors du menu. */}
      {ouvert && (
        <button
          onClick={() => setOuvert(false)}
          aria-hidden
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          ouvert ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="border-b border-line px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-heading text-lg tracking-[0.2em]">
            {brand.name}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">Espace gestionnaire</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-halo/50 font-medium text-ink"
                  : "text-muted hover:bg-bg hover:text-ink"
              }`}
            >
              <span className="text-xs opacity-60">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-bg hover:text-ink"
        >
          ← Voir la boutique
        </Link>
      </div>
      </aside>
    </>
  );
}
