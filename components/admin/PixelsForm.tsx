"use client";

import { useState, useTransition } from "react";
import { savePixels } from "@/lib/actions/pixels";
import type { PixelConfig } from "@/lib/pixels-types";

const FIELDS: { key: keyof PixelConfig; label: string; hint: string; icon: string }[] = [
  { key: "meta", label: "Meta / Facebook Pixel", hint: "ID du pixel (ex : 123456789012345)", icon: "f" },
  { key: "tiktok", label: "TikTok Pixel", hint: "Pixel ID (ex : C1A2B3...)", icon: "T" },
  { key: "snapchat", label: "Snapchat Pixel", hint: "Pixel ID (ex : xxxx-xxxx-xxxx)", icon: "S" },
  { key: "pinterest", label: "Pinterest Tag", hint: "Tag ID (ex : 2612...)", icon: "P" },
  { key: "google", label: "Google Analytics 4", hint: "ID de mesure (ex : G-XXXXXXX)", icon: "G" },
  { key: "googleAds", label: "Google Ads — identifiant", hint: "ID de conversion (ex : AW-123456789)", icon: "A" },
  {
    key: "googleAdsLabel",
    label: "Google Ads — libellé de conversion",
    hint: "Libellé de l'action Achat (ex : AbC-D_efGh)",
    icon: "A",
  },
  { key: "taboola", label: "Taboola", hint: "Account ID", icon: "t" },
];

export default function PixelsForm({ initial }: { initial: PixelConfig }) {
  const [values, setValues] = useState<PixelConfig>(initial);
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState("");
  const [pending, start] = useTransition();

  /* Vrai en cas de saisie non enregistrée : c'est ce qui manquait le jour où un
     identifiant tapé mais jamais soumis a fait croire à un pixel installé. */
  const modifie = FIELDS.some((f) => values[f.key] !== initial[f.key]);

  /* Google Ads a besoin de SES DEUX champs. Un seul rempli, la balise se charge
     et tout paraît normal — mais aucun achat ne remonte, et on ne s'en aperçoit
     qu'en constatant zéro conversion des semaines plus tard. */
  const googleAdsIncomplet =
    !!values.googleAds !== !!values.googleAdsLabel;

  const save = () =>
    start(async () => {
      setErreur("");
      try {
        await savePixels(values);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        // ⚠️ Sans ce message, un échec d'enregistrement est INVISIBLE : le champ
        // garde la valeur tapée, l'écran paraît normal, et la boutique tourne
        // sans pixel — donc sans aucune conversion remontée aux régies.
        setErreur("Enregistrement impossible. Vérifiez la connexion et réessayez.");
      }
    });

  return (
    <div className="space-y-4">
      {FIELDS.map((f) => {
        const active = !!values[f.key];
        return (
          <div
            key={f.key}
            className={`flex items-center gap-4 rounded-2xl border bg-surface p-5 ${
              active ? "border-primary/50" : "border-line"
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-heading text-lg ${
                active ? "bg-halo text-primary-dark" : "bg-bg text-muted"
              }`}
            >
              {f.icon}
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">{f.label}</label>
              <input
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.hint}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <span
              className={`text-xs ${
                values[f.key] !== initial[f.key]
                  ? "text-primary-dark"
                  : active
                    ? "text-organic"
                    : "text-muted"
              }`}
            >
              {values[f.key] !== initial[f.key]
                ? "● Non enregistré"
                : active
                  ? "● Actif"
                  : "○ Inactif"}
            </span>
          </div>
        );
      })}

      {googleAdsIncomplet && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Google Ads demande les deux champs. Avec un seul, la balise se charge
          mais aucun achat n&apos;est remonté à la régie.
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-ink px-7 py-3 text-sm font-medium text-bg hover:bg-primary-dark disabled:opacity-50"
        >
          {saved ? "Enregistré ✓" : pending ? "…" : "Enregistrer les pixels"}
        </button>
        <span className="text-xs text-muted">
          {modifie
            ? "Vos modifications ne sont pas encore enregistrées."
            : "Les pixels se chargent automatiquement sur la boutique (hors admin)."}
        </span>
      </div>

      {erreur && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
    </div>
  );
}
