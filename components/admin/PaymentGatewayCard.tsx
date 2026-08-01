"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentProvider, PspMode } from "@/lib/payments/types";
import { saveGateway, type GatewaySaved } from "@/lib/actions/settings";

export default function PaymentGatewayCard({
  provider,
  initial,
}: {
  provider: PaymentProvider;
  initial?: GatewaySaved;
}) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [mode, setMode] = useState<PspMode>(initial?.mode ?? "test");
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [secretsSet, setSecretsSet] = useState<string[]>(initial?.secretsSet ?? []);
  const [saved, setSaved] = useState(false);
  const [refus, setRefus] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  // Activer une autre passerelle éteint celle-ci côté serveur : il faut que
  // l'interrupteur suive, sinon deux cartes s'afficheraient comme actives.
  useEffect(() => {
    setEnabled(initial?.enabled ?? false);
  }, [initial?.enabled]);

  const fields = provider.fields[mode];

  /**
   * Une seule passerelle est active à la fois : après un changement, on
   * recharge la page pour que les autres cartes reflètent leur extinction.
   */
  const persist = (next: { enabled: boolean; mode: PspMode }) =>
    start(async () => {
      const res = await saveGateway(provider.id, {
        enabled: next.enabled,
        mode: next.mode,
        credentials: values,
      });
      if (!res.ok) {
        // Refus (clés manquantes) : on remet l'interrupteur dans son état réel.
        setEnabled(false);
        setRefus(res.error ?? "Activation impossible.");
        setOpen(true);
        return;
      }
      setRefus("");
      router.refresh();
    });

  const save = () =>
    start(async () => {
      const res = await saveGateway(provider.id, { enabled, mode, credentials: values });
      if (!res.ok) {
        setEnabled(false);
        setRefus(res.error ?? "Enregistrement impossible.");
        return;
      }
      setRefus("");
      // Marque comme enregistrés les secrets qui viennent d'être saisis.
      const newlySet = fields
        .filter((f) => f.secret && values[f.key])
        .map((f) => f.key);
      setSecretsSet((s) => Array.from(new Set([...s, ...newlySet])));
      setValues((v) => {
        const copy = { ...v };
        newlySet.forEach((k) => delete copy[k]); // ne pas garder le secret en clair en state
        return copy;
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });

  return (
    <div className={`rounded-2xl border bg-surface transition ${enabled ? "border-primary/60" : "border-line"}`}>
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-heading text-lg ${enabled ? "bg-halo text-primary-dark" : "bg-bg text-muted"}`}>
            {provider.name[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{provider.name}</p>
              {provider.functional ? (
                <span className="rounded-full bg-organic/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-organic">
                  ✓ Fonctionnel
                </span>
              ) : (
                <span className="rounded-full bg-halo px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-dark">
                  Intégration à finaliser
                </span>
              )}
            </div>
            <p className="text-xs text-muted">{provider.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setOpen((o) => !o)} className="text-sm text-muted hover:text-ink">
            {open ? "Réduire" : "Configurer"}
          </button>
          <button
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              if (next) setOpen(true);
              persist({ enabled: next, mode });
            }}
            role="switch"
            aria-checked={enabled}
            aria-label={`Activer ${provider.name}`}
            className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-primary" : "bg-line"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {refus && (
        <p className="border-t border-line bg-secondary/5 px-5 py-3 text-sm text-secondary">
          {refus}
        </p>
      )}

      {open && (
        <div className="border-t border-line p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="inline-flex rounded-full border border-line p-0.5">
              {(["test", "live"] as PspMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); persist({ enabled, mode: m }); }}
                  className={`rounded-full px-4 py-1.5 text-sm transition ${
                    mode === m ? (m === "live" ? "bg-secondary text-white" : "bg-ink text-bg") : "text-muted hover:text-ink"
                  }`}
                >
                  {m === "test" ? "Test / Sandbox" : "Live / Production"}
                </button>
              ))}
            </div>
            <span className="rounded-full bg-organic/15 px-2.5 py-1 text-xs font-medium text-organic">
              PCI {provider.pciScope}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const isSecret = f.secret && !reveal[f.key];
              const alreadySet = f.secret && secretsSet.includes(f.key);
              return (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">
                    {f.label}
                    {alreadySet && <span className="ml-2 text-organic">· enregistré</span>}
                  </span>
                  <div className="relative">
                    <input
                      type={isSecret ? "password" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={alreadySet ? "•••••••• (laisser vide pour conserver)" : f.hint ?? "••••••••••••"}
                      autoComplete="off"
                      className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 pr-12 text-sm outline-none transition focus:border-primary"
                    />
                    {f.secret && (
                      <button
                        type="button"
                        onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink"
                      >
                        {reveal[f.key] ? "Masquer" : "Voir"}
                      </button>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
            <span>{provider.webhookSigned ? "✓ Webhooks signés" : "Webhooks"} · vérifiés côté serveur</span>
            <span>✓ Aucune donnée carte stockée</span>
            <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-primary-dark hover:underline">
              Documentation ↗
            </a>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button onClick={save} disabled={pending} className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-bg hover:bg-primary-dark disabled:opacity-50">
              {saved ? "Enregistré ✓" : pending ? "…" : "Enregistrer les clés"}
            </button>
            {mode === "live" && (
              <span className="text-xs text-secondary">⚠ Mode production : les paiements seront réels.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
