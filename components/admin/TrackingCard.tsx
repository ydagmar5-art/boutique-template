"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderTracking } from "@/lib/actions/orders";
import { carrierLabel, trackingUrl } from "@/lib/carriers";
import type { OrderTracking } from "@/lib/db/seed";
import ShippingDialog from "@/components/admin/ShippingDialog";

/** Encart « suivi » de la fiche commande : consultation et correction. */
export default function TrackingCard({
  id,
  tracking,
}: {
  id: string;
  tracking?: OrderTracking;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const url = tracking ? trackingUrl(tracking) : "";

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Suivi</h2>
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-muted hover:text-ink"
        >
          {tracking ? "Modifier" : "Ajouter"}
        </button>
      </div>

      {tracking?.number ? (
        <>
          <p className="text-sm text-muted">{carrierLabel(tracking.carrier)}</p>
          <p className="mt-0.5 font-mono text-base">{tracking.number}</p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-primary-dark hover:underline"
            >
              Suivre le colis ↗
            </a>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Aucun numéro de suivi.</p>
      )}

      {editing && (
        <ShippingDialog
          orderId={id}
          initial={tracking}
          editing
          pending={pending}
          onCancel={() => setEditing(false)}
          onSubmit={(tr, notify) => {
            setEditing(false);
            start(async () => {
              await setOrderTracking(id, tr, notify);
              router.refresh();
            });
          }}
        />
      )}
    </div>
  );
}
