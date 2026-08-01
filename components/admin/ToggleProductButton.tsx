"use client";

import { useTransition } from "react";
import { toggleProductHidden } from "@/lib/actions/products";

export default function ToggleProductButton({
  slug,
  hidden,
}: {
  slug: string;
  hidden: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => toggleProductHidden(slug).then(() => {}))}
      title={
        hidden
          ? "Remettre ce produit en vente dans la boutique"
          : "Retirer ce produit de la boutique (il reste dans le back-office)"
      }
      className="text-sm text-muted hover:text-ink disabled:opacity-50"
    >
      {pending ? "…" : hidden ? "Afficher" : "Masquer"}
    </button>
  );
}
