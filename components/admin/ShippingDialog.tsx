"use client";

import { useEffect, useState } from "react";
import { CARRIERS, DEFAULT_CARRIER } from "@/lib/carriers";
import type { OrderTracking } from "@/lib/db/seed";

/**
 * Fenêtre de saisie du suivi, affichée avant de passer une commande en
 * « expédiée » (et réutilisée pour corriger un suivi existant).
 * Le numéro est facultatif : on peut expédier sans traçabilité.
 */
export default function ShippingDialog({
  orderId,
  initial,
  editing,
  pending,
  onCancel,
  onSubmit,
}: {
  orderId: string;
  initial?: OrderTracking;
  /** Mode correction d'un suivi déjà enregistré (propose de prévenir le client). */
  editing?: boolean;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (tracking: OrderTracking, notify: boolean) => void;
}) {
  const [carrier, setCarrier] = useState(initial?.carrier ?? DEFAULT_CARRIER);
  const [number, setNumber] = useState(initial?.number ?? "");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ carrier, number }, notify);
  };

  return (
    <div
      // bg-black/40 et non bg-ink/40 : Tailwind ne peut pas appliquer d'opacité
      // à --c-ink (hex), la couleur sortirait entièrement transparente.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !pending && onCancel()}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
      >
        <h2 className="font-heading text-xl">
          {editing ? "Modifier le suivi" : "Expédier la commande"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {orderId} · le client recevra un e-mail avec son numéro de suivi.
        </p>

        <label className="mt-5 block text-sm font-medium">Transporteur</label>
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          {CARRIERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium">
          Numéro de suivi <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Ex. 1234567890"
          autoFocus
          className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-sm outline-none focus:border-primary"
        />
        <p className="mt-1.5 text-xs text-muted">
          Laissé vide, l&apos;e-mail part sans bloc de suivi.
        </p>

        {editing && (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="accent-primary"
            />
            Prévenir le client par e-mail
          </label>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "…" : editing ? "Enregistrer" : "Marquer expédiée"}
          </button>
        </div>
      </form>
    </div>
  );
}
