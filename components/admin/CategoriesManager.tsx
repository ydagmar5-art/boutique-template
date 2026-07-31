"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCategory, deleteCategory } from "@/lib/actions/categories";

export default function CategoriesManager({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const add = () => {
    if (!name.trim()) return;
    start(async () => {
      await addCategory(name);
      setName("");
      router.refresh();
    });
  };

  const remove = (c: string) => {
    if (!confirm(`Supprimer la catégorie « ${c} » ?`)) return;
    start(async () => {
      await deleteCategory(c);
      router.refresh();
    });
  };

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nouvelle catégorie (ex : Suspensions)"
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg hover:bg-primary-dark disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {categories.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">Aucune catégorie.</p>
        ) : (
          <ul>
            {categories.map((c) => (
              <li key={c} className="flex items-center justify-between border-b border-line px-6 py-3.5 last:border-0">
                <span className="font-medium">{c}</span>
                <button
                  onClick={() => remove(c)}
                  disabled={pending}
                  className="text-sm text-muted hover:text-secondary disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted">
        Les catégories apparaissent dans le menu déroulant à la création/modification
        d&apos;un produit et comme filtres sur la boutique.
      </p>
    </div>
  );
}
