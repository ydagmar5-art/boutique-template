"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deletePromotion,
  savePromotion,
  togglePromotion,
} from "@/lib/actions/promotions";
import { describe, isLive, type Promotion, type PromoKind, type PromoScope } from "@/lib/promotions";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary";

/** Offre neuve, pré-remplie sur le cas le plus demandé : 2 achetés = 1 offert. */
const blank = (): Promotion => ({
  id: `promo-${Date.now().toString(36)}`,
  name: "",
  enabled: true,
  kind: "bogo",
  scope: "all",
  buyQty: 2,
  getQty: 1,
  getPercent: 100,
});

export default function PromotionsManager({
  initial,
  categories,
  products,
}: {
  initial: Promotion[];
  categories: string[];
  products: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Promotion | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const set = (patch: Partial<Promotion>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const submit = () => {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Donnez un nom à l'offre.");
    if (draft.kind === "percent" && !draft.percent)
      return setError("Indiquez le pourcentage de remise.");
    if (draft.kind === "amount" && !draft.amount)
      return setError("Indiquez le montant de la remise.");
    if (draft.scope === "collection" && !draft.collection)
      return setError("Choisissez une catégorie.");
    if (draft.scope === "products" && !draft.slugs?.length)
      return setError("Choisissez au moins un produit.");
    setError("");
    start(async () => {
      await savePromotion(draft);
      setDraft(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {!draft && (
        <button
          onClick={() => setDraft(blank())}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-primary-dark"
        >
          + Créer une offre
        </button>
      )}

      {draft && (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="Nom de l'offre (vu par le client)">
              <input
                className={field}
                placeholder="2 achetées, la 3ᵉ offerte"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Label>

            <Label text="Code promo (vide = offre automatique)">
              <input
                className={`${field} uppercase`}
                placeholder="BIENVENUE10"
                value={draft.code ?? ""}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              />
            </Label>
          </div>

          <Label text="Type d'offre">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["bogo", "X achetés, Y offerts"],
                  ["percent", "Remise en %"],
                  ["amount", "Remise en €"],
                ] as [PromoKind, string][]
              ).map(([k, lib]) => (
                <button
                  key={k}
                  onClick={() => set({ kind: k })}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    draft.kind === k
                      ? "border-primary bg-halo text-ink"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {lib}
                </button>
              ))}
            </div>
          </Label>

          {draft.kind === "bogo" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Label text="Quantité achetée">
                <input
                  className={field}
                  type="number"
                  min={1}
                  value={draft.buyQty ?? 2}
                  onChange={(e) => set({ buyQty: Number(e.target.value) })}
                />
              </Label>
              <Label text="Quantité offerte">
                <input
                  className={field}
                  type="number"
                  min={1}
                  value={draft.getQty ?? 1}
                  onChange={(e) => set({ getQty: Number(e.target.value) })}
                />
              </Label>
              <Label text="Remise sur les offerts">
                <select
                  className={field}
                  value={draft.getPercent ?? 100}
                  onChange={(e) => set({ getPercent: Number(e.target.value) })}
                >
                  <option value={100}>100 % — offert</option>
                  <option value={50}>50 % — moitié prix</option>
                  <option value={30}>30 %</option>
                  <option value={25}>25 %</option>
                </select>
              </Label>
            </div>
          )}

          {draft.kind === "percent" && (
            <Label text="Pourcentage de remise">
              <input
                className={field}
                type="number"
                min={1}
                max={100}
                value={draft.percent ?? ""}
                onChange={(e) => set({ percent: Number(e.target.value) })}
              />
            </Label>
          )}

          {draft.kind === "amount" && (
            <Label text="Montant de la remise (€)">
              <input
                className={field}
                type="number"
                step="0.01"
                value={draft.amount ? draft.amount / 100 : ""}
                onChange={(e) =>
                  set({ amount: Math.round(parseFloat(e.target.value || "0") * 100) })
                }
              />
            </Label>
          )}

          <Label text="S'applique à">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Tout le catalogue"],
                  ["collection", "Une catégorie"],
                  ["products", "Des produits choisis"],
                ] as [PromoScope, string][]
              ).map(([s, lib]) => (
                <button
                  key={s}
                  onClick={() => set({ scope: s })}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    draft.scope === s
                      ? "border-primary bg-halo text-ink"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {lib}
                </button>
              ))}
            </div>
          </Label>

          {draft.scope === "collection" && (
            <Label text="Catégorie">
              <select
                className={field}
                value={draft.collection ?? ""}
                onChange={(e) => set({ collection: e.target.value })}
              >
                <option value="">— choisir —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Label>
          )}

          {draft.scope === "products" && (
            <Label text="Produits concernés">
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line bg-bg p-3">
                {products.map((p) => {
                  const on = draft.slugs?.includes(p.slug) ?? false;
                  return (
                    <label key={p.slug} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={on}
                        onChange={() =>
                          set({
                            slugs: on
                              ? (draft.slugs ?? []).filter((s) => s !== p.slug)
                              : [...(draft.slugs ?? []), p.slug],
                          })
                        }
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            </Label>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Label text="Panier minimum (€)">
              <input
                className={field}
                type="number"
                step="0.01"
                placeholder="aucun"
                value={draft.minSubtotal ? draft.minSubtotal / 100 : ""}
                onChange={(e) =>
                  set({
                    minSubtotal: e.target.value
                      ? Math.round(parseFloat(e.target.value) * 100)
                      : undefined,
                  })
                }
              />
            </Label>
            <Label text="Début (optionnel)">
              <input
                className={field}
                type="date"
                value={draft.startsAt ?? ""}
                onChange={(e) => set({ startsAt: e.target.value || undefined })}
              />
            </Label>
            <Label text="Fin (optionnel)">
              <input
                className={field}
                type="date"
                value={draft.endsAt ?? ""}
                onChange={(e) => set({ endsAt: e.target.value || undefined })}
              />
            </Label>
            <Label text="Limite d'utilisations">
              <input
                className={field}
                type="number"
                min={1}
                placeholder="illimité"
                value={draft.usageLimit ?? ""}
                onChange={(e) =>
                  set({
                    usageLimit: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Label>
          </div>

          {error && <p className="text-sm text-secondary">{error}</p>}

          <div className="flex items-center gap-3 border-t border-line pt-5">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-full bg-ink px-7 py-3 text-sm font-medium text-bg hover:bg-primary-dark disabled:opacity-50"
            >
              {pending ? "Enregistrement…" : "Enregistrer l'offre"}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setError("");
              }}
              className="text-sm text-muted hover:text-ink"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {initial.length === 0 && !draft ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Aucune offre pour le moment. Créez-en une : elle s&apos;appliquera
          automatiquement au panier, ou sur saisie d&apos;un code promo.
        </p>
      ) : (
        <div className="space-y-3">
          {initial.map((p) => (
            <Row
              key={p.id}
              promo={p}
              onEdit={() => setDraft(p)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  promo,
  onEdit,
  onChanged,
}: {
  promo: Promotion;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const live = isLive(promo);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-medium ${promo.enabled ? "" : "text-muted"}`}>
            {promo.name}
          </p>
          {promo.code ? (
            <span className="rounded-full bg-halo px-2 py-0.5 font-mono text-[11px] font-medium text-primary-dark">
              {promo.code}
            </span>
          ) : (
            <span className="rounded-full bg-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              Automatique
            </span>
          )}
          {promo.enabled && !live && (
            <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary">
              Inactive
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">{describe(promo)}</p>
        <p className="mt-0.5 text-xs text-muted">
          {promo.minSubtotal
            ? `Dès ${formatPrice(promo.minSubtotal, brand.currency, brand.locale)} d'achat · `
            : ""}
          {promo.startsAt || promo.endsAt
            ? `${promo.startsAt ?? "…"} → ${promo.endsAt ?? "…"} · `
            : ""}
          {promo.usageLimit
            ? `${promo.usageCount ?? 0}/${promo.usageLimit} utilisations`
            : `${promo.usageCount ?? 0} utilisation(s)`}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => start(async () => {
            await togglePromotion(promo.id);
            onChanged();
          })}
          disabled={pending}
          role="switch"
          aria-checked={promo.enabled}
          aria-label={`Activer ${promo.name}`}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            promo.enabled ? "bg-primary" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              promo.enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
        <button onClick={onEdit} className="text-sm text-muted hover:text-ink">
          Modifier
        </button>
        <button
          onClick={() => {
            if (confirm(`Supprimer l'offre « ${promo.name} » ?`))
              start(async () => {
                await deletePromotion(promo.id);
                onChanged();
              });
          }}
          disabled={pending}
          className="text-sm text-muted hover:text-secondary disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{text}</span>
      {children}
    </label>
  );
}
