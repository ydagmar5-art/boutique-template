"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHeroSlug } from "@/lib/actions/storefront";
import type { Product } from "@/lib/products";

/**
 * Choix du modèle mis en avant dans le hero de l'accueil.
 *
 * Pensé pour l'A/B test : on change de modèle, on laisse tourner quelques
 * jours, on compare dans les statistiques. La liste ne propose que des
 * produits visibles — mettre en vitrine un modèle masqué afficherait un hero
 * qui renvoie vers une fiche en 404.
 */
export default function HeroPicker({
  products,
  current,
}: {
  products: Product[];
  current: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(current);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const choisir = (value: string) => {
    setSlug(value);
    setSaved(false);
    start(async () => {
      await setHeroSlug(value);
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 2500);
    });
  };

  const choisi = products.find((p) => p.slug === slug);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Modèle en vitrine</h2>
          <p className="mt-0.5 text-xs text-muted">
            Affiché en grand sur la page d&apos;accueil.
          </p>
        </div>
        {pending && <span className="text-xs text-muted">Enregistrement…</span>}
        {saved && !pending && (
          <span className="text-xs text-organic">Enregistré</span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        {choisi && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={choisi.images[0]}
            alt=""
            className="h-16 w-[52px] shrink-0 rounded-lg object-cover"
          />
        )}
        <select
          value={slug}
          onChange={(e) => choisir(e.target.value)}
          disabled={pending}
          aria-label="Modèle affiché dans le hero de l'accueil"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-50"
        >
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} — {p.collection}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
