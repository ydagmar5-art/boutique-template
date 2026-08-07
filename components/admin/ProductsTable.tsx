"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { brand } from "@/config/brand.config";
import { formatPrice, type Product } from "@/lib/products";
import { reorderProducts } from "@/lib/actions/products";
import DeleteProductButton from "@/components/admin/DeleteProductButton";
import ToggleProductButton from "@/components/admin/ToggleProductButton";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CATALOGUE — CLASSEMENT À LA MAIN                                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Le gérant range ses modèles lui-même en glissant les lignes : l'ordre de
 * cette liste est EXACTEMENT l'ordre de la boutique (aucun tri automatique
 * entre le stockage et la vitrine — cf. `reorderProducts`).
 *
 * ⚠️ Deux gestes, pas un. Le glisser-déposer HTML5 n'existe pas au doigt :
 * sur mobile — où le back-office est réellement utilisé — seules les flèches
 * fonctionnent. Retirer les flèches rendrait le classement impossible depuis
 * un téléphone.
 *
 * ⚠️ L'enregistrement est OPTIMISTE : la liste bouge tout de suite et
 * l'écriture part derrière. En cas d'échec on remet l'ordre initial plutôt
 * que de laisser croire à un classement enregistré qui ne l'est pas.
 */
export default function ProductsTable({ products }: { products: Product[] }) {
  const [items, setItems] = useState(products);
  const [drag, setDrag] = useState<string | null>(null);
  const [etat, setEtat] = useState<"repos" | "enregistre" | "echec">("repos");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le parent est rendu à chaque revalidation (création, suppression,
  // masquage) : on resynchronise, sinon la ligne supprimée resterait à
  // l'écran jusqu'au rechargement complet.
  useEffect(() => setItems(products), [products]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function enregistrer(ordre: Product[]) {
    const avant = items;
    setItems(ordre);
    startTransition(async () => {
      try {
        await reorderProducts(ordre.map((p) => p.slug));
        setEtat("enregistre");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setEtat("repos"), 2200);
      } catch {
        setItems(avant);
        setEtat("echec");
      }
    });
  }

  function deplacer(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const ordre = [...items];
    const [ligne] = ordre.splice(from, 1);
    ordre.splice(to, 0, ligne);
    enregistrer(ordre);
  }

  const indexDe = (slug: string) => items.findIndex((p) => p.slug === slug);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <p className="text-xs text-muted">
          Glissez une ligne pour classer vos modèles dans la boutique.
        </p>
        <span
          className={`text-xs transition-opacity ${
            etat === "repos" ? "opacity-0" : "opacity-100"
          } ${etat === "echec" ? "text-secondary" : "text-muted"}`}
          aria-live="polite"
        >
          {etat === "echec" ? "Ordre non enregistré" : "Ordre enregistré"}
        </span>
      </div>

      <table className="w-full min-w-[38rem] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted">
            <th className="w-10 px-2 py-3"></th>
            <th className="px-4 py-3 font-medium sm:px-6">Produit</th>
            <th className="px-4 py-3 font-medium sm:px-6">Collection</th>
            <th className="px-4 py-3 font-medium sm:px-6">Stock</th>
            <th className="px-4 py-3 text-right font-medium sm:px-6">Prix</th>
            <th className="px-4 py-3 sm:px-6"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => {
            const stock = p.variants.reduce((n, v) => n + v.stock, 0);
            return (
              <tr
                key={p.slug}
                draggable
                onDragStart={(e) => {
                  setDrag(p.slug);
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox n'amorce pas le glisser sans charge utile.
                  e.dataTransfer.setData("text/plain", p.slug);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const slug = drag ?? e.dataTransfer.getData("text/plain");
                  if (slug && slug !== p.slug) deplacer(indexDe(slug), i);
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
                className={`border-t border-line ${
                  drag === p.slug ? "opacity-40" : ""
                }`}
              >
                <td className="px-2 py-3.5 align-middle">
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => deplacer(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Monter ${p.name}`}
                      className="px-1 leading-none text-muted hover:text-ink disabled:opacity-25"
                    >
                      ▲
                    </button>
                    <span
                      aria-hidden
                      className="cursor-grab select-none text-muted active:cursor-grabbing"
                      title="Glisser pour classer"
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      onClick={() => deplacer(i, i + 1)}
                      disabled={i === items.length - 1}
                      aria-label={`Descendre ${p.name}`}
                      className="px-1 leading-none text-muted hover:text-ink disabled:opacity-25"
                    >
                      ▼
                    </button>
                  </div>
                </td>

                <td className="px-4 py-3.5 sm:px-6">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      draggable={false}
                      className={`h-11 w-9 rounded-md object-cover ${p.hidden ? "opacity-40 grayscale" : ""}`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${p.hidden ? "text-muted" : ""}`}>{p.name}</p>
                        {p.hidden && (
                          <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                            Masqué
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{p.variants.length} variantes</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-muted sm:px-6">{p.collection}</td>
                <td className="px-4 py-3.5 sm:px-6">
                  {p.manageStock ? (
                    <span className={stock > 10 ? "text-organic" : stock > 0 ? "text-primary-dark" : "text-secondary"}>
                      {stock} en stock
                    </span>
                  ) : (
                    <span className="text-muted">Non géré</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right sm:px-6">
                  {formatPrice(p.price, brand.currency, brand.locale)}
                </td>
                <td className="px-4 py-3.5 sm:px-6">
                  <div className="flex items-center justify-end gap-4">
                    <ToggleProductButton slug={p.slug} hidden={!!p.hidden} />
                    <Link href={`/admin/products/${p.slug}/edit`} className="text-sm text-muted hover:text-ink">
                      Modifier
                    </Link>
                    <DeleteProductButton slug={p.slug} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
