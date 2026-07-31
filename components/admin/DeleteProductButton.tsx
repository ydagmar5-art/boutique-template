"use client";

import { useTransition } from "react";
import { deleteProduct } from "@/lib/actions/products";

export default function DeleteProductButton({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Supprimer ce produit ?")) start(() => deleteProduct(slug));
      }}
      className="text-sm text-muted hover:text-secondary disabled:opacity-50"
    >
      {pending ? "…" : "Supprimer"}
    </button>
  );
}
