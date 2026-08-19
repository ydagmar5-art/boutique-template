"use client";

import { useEffect, useState } from "react";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import { getFunnel, type FunnelResult } from "@/lib/actions/analytics";

const PRESETS = [
  { key: "today", label: "Aujourd'hui", days: 1 },
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
  { key: "90d", label: "90 jours", days: 90 },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

/**
 * Fenêtre [début, maintenant] pour une durée en jours, bornes incluses.
 *
 * `days - 1` : « 7 jours » couvre aujourd'hui plus les six précédents, pas
 * sept jours EN PLUS d'aujourd'hui. Le cas `days: 1` en découle sans rien
 * ajouter — le décalage est nul, la borne basse tombe à minuit ce matin.
 *
 * ⚠️ Composant client : les dates suivent le fuseau du NAVIGATEUR, pas celui
 * du serveur. C'est voulu — « aujourd'hui » doit vouloir dire la journée de
 * celle qui regarde l'écran.
 */
function rangeFor(days: number): [string, string] {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return [from.toISOString(), to.toISOString()];
}

const pct = (n: number) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: n < 10 ? 1 : 0 })} %`;

/**
 * Entonnoir de conversion.
 *
 * Chaque barre est proportionnelle aux SESSIONS, pas à l'étape précédente :
 * c'est ce qui donne la forme d'entonnoir et rend les décrochages visibles
 * d'un coup d'œil. Le pourcentage affiché à droite, lui, est celui de l'étape
 * PRÉCÉDENTE — c'est là que se lit la fuite à corriger.
 */
export default function ConversionFunnel() {
  const [preset, setPreset] = useState<PresetKey>("today");
  const [data, setData] = useState<FunnelResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const days = PRESETS.find((p) => p.key === preset)!.days;
    const [from, to] = rangeFor(days);
    setLoading(true);
    getFunnel(from, to)
      .then(setData)
      .finally(() => setLoading(false));
  }, [preset]);

  const sessions = data?.steps[0]?.visitors ?? 0;
  const vide = !loading && sessions === 0;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Entonnoir de conversion</h2>
          <p className="mt-0.5 text-xs text-muted">
            Visiteurs distincts à chaque étape du parcours d&apos;achat.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-line p-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                preset === p.key ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-8 text-sm text-muted">Chargement…</p>}

      {/* ⚠️ Deux messages, pas un. « Aujourd'hui » étant la vue par défaut,
          une journée encore calme est le cas COURANT : annoncer que
          l'entonnoir « se remplira dès les premiers passages » laisserait
          croire que la boutique n'a jamais reçu personne. */}
      {vide && (
        <p className="py-8 text-sm text-muted">
          {preset === "today"
            ? "Aucune visite depuis minuit. Élargissez la période pour voir les jours précédents."
            : "Aucune visite sur la période. L'entonnoir se remplira dès les premiers passages sur la boutique."}
        </p>
      )}

      {!loading && !vide && data && (
        <>
          <div className="space-y-3">
            {data.steps.map((s, i) => (
              <div key={s.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-ink">{s.label}</span>
                  <span className="flex items-baseline gap-3 whitespace-nowrap">
                    <span className="font-medium text-ink">
                      {s.visitors.toLocaleString("fr-FR")}
                    </span>
                    {i > 0 && (
                      <span
                        className={`text-xs ${
                          s.shareOfPrevious < 25 ? "text-secondary" : "text-muted"
                        }`}
                        title="Part de l'étape précédente"
                      >
                        {pct(s.shareOfPrevious)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-md bg-bg">
                  <div
                    className="h-full rounded-md bg-ink transition-[width] duration-500"
                    style={{
                      width: `${Math.max(s.shareOfSessions, s.visitors > 0 ? 2 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">
                Taux de conversion
              </p>
              <p className="mt-1 font-heading text-2xl font-light">
                {pct(data.conversionRate)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">
                Commandes enregistrées
              </p>
              <p className="mt-1 font-heading text-2xl font-light">
                {data.ordersRecorded.toLocaleString("fr-FR")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">
                Panier moyen
              </p>
              <p className="mt-1 font-heading text-2xl font-light">
                {formatPrice(
                  data.averageOrderValue,
                  brand.currency,
                  brand.locale,
                )}
              </p>
            </div>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-muted">
            Le pourcentage à droite de chaque étape est la part de l&apos;étape
            précédente : c&apos;est là que se lisent les décrochages. La
            dernière étape est mesurée depuis le navigateur de l&apos;acheteuse
            et peut différer légèrement des commandes réellement enregistrées —
            un écart important signale un problème de mesure, pas une baisse de
            ventes.
          </p>
        </>
      )}
    </section>
  );
}
