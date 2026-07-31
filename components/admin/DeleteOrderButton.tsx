"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteOrder } from "@/lib/actions/orders";

export default function DeleteOrderButton({
  id,
  redirectTo,
  className = "",
  label = "Supprimer",
}: {
  id: string;
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Supprimer définitivement la commande ${id} ?`)) return;
        start(async () => {
          await deleteOrder(id);
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        });
      }}
      className={
        className ||
        "text-sm text-muted transition-colors hover:text-secondary disabled:opacity-50"
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
