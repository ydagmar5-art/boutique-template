"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { deleteOrders, setOrdersArchived } from "@/lib/actions/orders";
import { carrierLabel } from "@/lib/carriers";
import { type Order } from "@/lib/db/seed";
import { SOURCE_LABEL, type SourceVente } from "@/lib/attribution";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [pending, start] = useTransition();

  /*
    Recherche : le gérant retrouve une commande par NOM au moment d'expédier.
    Elle porte aussi sur le numéro et l'e-mail — c'est souvent ce qu'on a sous
    les yeux (bordereau, message client) quand on cherche une ligne.
  */
  const [recherche, setRecherche] = useState("");

  const filtre = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return (list: Order[]) => list;
    return (list: Order[]) =>
      list.filter((o) =>
        [o.customer, o.id, o.email, o.phone ?? "", o.address ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
  }, [recherche]);

  const active = useMemo(
    () => filtre(orders.filter((o) => !o.archived)),
    [orders, filtre],
  );
  const archived = useMemo(
    () => filtre(orders.filter((o) => o.archived)),
    [orders, filtre],
  );
  const visible = showArchived ? archived : active;

  const allChecked = visible.length > 0 && visible.every((o) => selected.has(o.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(visible.map((o) => o.id)));

  // Changer d'onglet remet la sélection à zéro : elle ne vaut que pour la vue.
  const switchTab = (toArchived: boolean) => {
    setShowArchived(toArchived);
    setSelected(new Set());
  };

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      setSelected(new Set());
      router.refresh();
    });

  const removeSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`Supprimer ${selected.size} commande(s) ?`)) return;
    run(() => deleteOrders([...selected]));
  };

  const removeOne = (id: string) => {
    if (!confirm(`Supprimer la commande ${id} ?`)) return;
    run(() => deleteOrders([id]));
  };

  const archiveSelected = () => {
    if (selected.size === 0) return;
    run(() => setOrdersArchived([...selected], !showArchived));
  };

  const tab = (label: string, count: number, isArchived: boolean) => (
    <button
      onClick={() => switchTab(isArchived)}
      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
        showArchived === isArchived
          ? "bg-ink text-bg"
          : "text-muted hover:text-ink"
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        {tab("Actives", active.length, false)}
        {tab("Archivées", archived.length, true)}
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom, n° de commande, e-mail, téléphone…"
          aria-label="Rechercher une commande"
          className="ml-auto min-w-48 flex-1 rounded-xl border border-line bg-bg px-4 py-2 text-sm outline-none focus:border-primary sm:max-w-xs sm:flex-none"
        />
        {recherche && (
          <button
            onClick={() => setRecherche("")}
            className="text-xs text-muted underline underline-offset-4 hover:text-ink"
          >
            Effacer
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between border-b border-line bg-halo/30 px-6 py-3">
          <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
          <div className="flex items-center gap-3">
            <button
              onClick={archiveSelected}
              disabled={pending}
              className="rounded-full border border-ink px-4 py-1.5 text-sm font-medium hover:bg-ink hover:text-bg disabled:opacity-50"
            >
              {pending ? "…" : showArchived ? "Désarchiver" : "Archiver"}
            </button>
            <button
              onClick={removeSelected}
              disabled={pending}
              className="rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : "Supprimer"}
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">
          {showArchived
            ? "Aucune commande archivée."
            : "Aucune commande active — tout est traité ✓"}
        </p>
      ) : (
        <table className="w-full min-w-[38rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-primary" aria-label="Tout sélectionner" />
              </th>
              <th className="px-4 py-3 font-medium">Commande</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Origine</th>
              <th className="px-4 py-3 font-medium">Passerelle</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <tr key={o.id} className={`border-t border-line ${selected.has(o.id) ? "bg-halo/20" : "hover:bg-bg/50"}`}>
                <td className="px-4 py-3.5">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="accent-primary" aria-label={`Sélectionner ${o.id}`} />
                </td>
                <td className="px-4 py-3.5 font-medium">
                  <Link href={`/admin/orders/${o.id}`} className="hover:text-primary-dark">{o.id}</Link>
                </td>
                <td className="px-4 py-3.5 text-muted">{o.date}</td>
                <td className="px-4 py-3.5">
                  <div>{o.customer}</div>
                  <div className="text-xs text-muted">{o.email}</div>
                </td>
                <td className="px-4 py-3.5">
                  {/* Origine de la PREMIÈRE visite — cf. lib/attribution.ts */}
                  <span className="whitespace-nowrap rounded-full bg-halo px-2.5 py-1 text-xs text-ink">
                    {SOURCE_LABEL[(o.source ?? "direct") as SourceVente] ??
                      o.source}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-muted">{o.psp}</td>
                <td className="px-4 py-3.5">
                  <OrderStatusSelect id={o.id} status={o.status} tracking={o.tracking} />
                  {o.tracking?.number && (
                    <div className="mt-1 text-xs text-muted">
                      {carrierLabel(o.tracking.carrier)} · <span className="font-mono">{o.tracking.number}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  {formatPrice(o.total, brand.currency, brand.locale)}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-sm text-muted hover:text-ink">Détails</Link>
                    <button
                      onClick={() => run(() => setOrdersArchived([o.id], !o.archived))}
                      disabled={pending}
                      className="text-sm text-muted hover:text-ink disabled:opacity-50"
                    >
                      {o.archived ? "Désarchiver" : "Archiver"}
                    </button>
                    <button onClick={() => removeOne(o.id)} disabled={pending} className="text-sm text-muted hover:text-secondary disabled:opacity-50">Suppr.</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
