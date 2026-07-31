"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrdersArchived } from "@/lib/actions/orders";

export default function ArchiveOrderButton({
  id,
  archived,
}: {
  id: string;
  archived?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() =>
        start(async () => {
          await setOrdersArchived([id], !archived);
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:border-ink hover:text-ink disabled:opacity-50"
    >
      {pending ? "…" : archived ? "Désarchiver" : "Archiver"}
    </button>
  );
}
