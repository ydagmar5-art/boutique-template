"use client";

import { useMemo, useState } from "react";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { STATUT_LABEL, type Contact, type ContactStatut } from "@/lib/contacts-types";

const FILTRES: { id: "tous" | ContactStatut; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "cliente", label: "Clientes" },
  { id: "inscrite", label: "Lettre" },
  { id: "cliente-inscrite", label: "Clientes + lettre" },
];

const jour = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";

/**
 * Carnet d'adresses + export CSV.
 *
 * ⚠️ L'export est SÉPARATEUR POINT-VIRGULE et porte un BOM UTF-8. C'est ce
 * qu'attend Excel en configuration française : avec une virgule, tout le
 * fichier atterrit dans une seule colonne ; sans BOM, les accents sortent en
 * caractères illisibles. Les outils d'e-mailing (Brevo, Mailchimp…)
 * acceptent l'un comme l'autre.
 *
 * L'export suit le FILTRE affiché : exporter « Lettre » seul est le cas le
 * plus fréquent, puisque c'est la population qui a consenti à recevoir des
 * campagnes.
 */
export default function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const [filtre, setFiltre] = useState<"tous" | ContactStatut>("tous");
  const [recherche, setRecherche] = useState("");

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return contacts.filter((c) => {
      const statutOk = filtre === "tous" || c.statut === filtre;
      const texteOk =
        !q || c.email.includes(q) || c.nom.toLowerCase().includes(q);
      return statutOk && texteOk;
    });
  }, [contacts, filtre, recherche]);

  const compte = (id: "tous" | ContactStatut) =>
    id === "tous" ? contacts.length : contacts.filter((c) => c.statut === id).length;

  const exporter = () => {
    const entetes = [
      "email",
      "nom",
      "telephone",
      "statut",
      "commandes",
      "total_depense_eur",
      "inscrite_le",
      "derniere_commande",
    ];
    const echappe = (v: string | number) => {
      const s = String(v ?? "");
      // Guillemets doublés : une adresse ou un nom contenant « ; » ou un
      // retour à la ligne casserait la colonne sans ça.
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lignes = visibles.map((c) =>
      [
        c.email,
        c.nom,
        c.telephone ?? "",
        STATUT_LABEL[c.statut],
        c.commandes,
        (c.depense / 100).toFixed(2).replace(".", ","),
        c.inscriteLe ? c.inscriteLe.slice(0, 10) : "",
        c.derniereCommande ? c.derniereCommande.slice(0, 10) : "",
      ]
        .map(echappe)
        .join(";"),
    );
    const csv = "﻿" + [entetes.join(";"), ...lignes].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `maison-romy-contacts-${filtre}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltre(f.id)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                filtre === f.id
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {f.label}
              <span className="ml-2 opacity-60">{compte(f.id)}</span>
            </button>
          ))}
        </div>

        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une adresse ou un nom"
          className="min-w-52 flex-1 rounded-xl border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-primary"
        />

        <button
          onClick={exporter}
          disabled={visibles.length === 0}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-primary-dark disabled:opacity-40"
        >
          Exporter en CSV ({visibles.length})
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-6 py-3 font-medium">E-mail</th>
              <th className="px-6 py-3 font-medium">Nom</th>
              <th className="px-6 py-3 font-medium">Statut</th>
              <th className="px-6 py-3 font-medium">Commandes</th>
              <th className="px-6 py-3 text-right font-medium">Total dépensé</th>
              <th className="px-6 py-3 font-medium">Inscrite le</th>
              <th className="px-6 py-3 font-medium">Dernière commande</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.email} className="border-t border-line hover:bg-bg/50">
                <td className="px-6 py-3.5 font-medium">{c.email}</td>
                <td className="px-6 py-3.5 text-muted">{c.nom || "—"}</td>
                <td className="px-6 py-3.5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs ${
                      c.statut === "inscrite"
                        ? "bg-halo text-ink"
                        : "bg-ink text-bg"
                    }`}
                  >
                    {STATUT_LABEL[c.statut]}
                  </span>
                </td>
                <td className="px-6 py-3.5">{c.commandes || "—"}</td>
                <td className="px-6 py-3.5 text-right">
                  {c.depense
                    ? formatPrice(c.depense, brand.currency, brand.locale)
                    : "—"}
                </td>
                <td className="px-6 py-3.5 text-muted">{jour(c.inscriteLe)}</td>
                <td className="px-6 py-3.5 text-muted">
                  {jour(c.derniereCommande)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibles.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-muted">
            {contacts.length === 0
              ? "Aucun contact pour l'instant. Les adresses arrivent avec les commandes et les inscriptions à la lettre."
              : "Aucun contact ne correspond à cette recherche."}
          </p>
        )}
      </div>
    </div>
  );
}
