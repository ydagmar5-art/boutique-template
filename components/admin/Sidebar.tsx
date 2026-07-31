"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/config/brand.config";

const nav = [
  { label: "Tableau de bord", href: "/admin", icon: "▤" },
  { label: "Statistiques", href: "/admin/stats", icon: "◔" },
  { label: "Commandes", href: "/admin/orders", icon: "▥" },
  { label: "Catalogue", href: "/admin/products", icon: "▦" },
  { label: "Catégories", href: "/admin/categories", icon: "▤" },
  { label: "Clients", href: "/admin/customers", icon: "▧" },
  { label: "Passerelles de paiement", href: "/admin/payments", icon: "▨" },
  { label: "Pixels & tracking", href: "/admin/pixels", icon: "◈" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
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
  );
}
