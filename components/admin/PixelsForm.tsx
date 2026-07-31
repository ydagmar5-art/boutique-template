"use client";

import { useState, useTransition } from "react";
import { savePixels } from "@/lib/actions/pixels";
import type { PixelConfig } from "@/lib/pixels-types";

const FIELDS: { key: keyof PixelConfig; label: string; hint: string; icon: string }[] = [
  { key: "meta", label: "Meta / Facebook Pixel", hint: "ID du pixel (ex : 123456789012345)", icon: "f" },
  { key: "tiktok", label: "TikTok Pixel", hint: "Pixel ID (ex : C1A2B3...)", icon: "T" },
  { key: "snapchat", label: "Snapchat Pixel", hint: "Pixel ID (ex : xxxx-xxxx-xxxx)", icon: "S" },
  { key: "pinterest", label: "Pinterest Tag", hint: "Tag ID (ex : 2612...)", icon: "P" },
  { key: "google", label: "Google (GA4 / Ads)", hint: "ID de mesure (ex : G-XXXX ou AW-XXXX)", icon: "G" },
  { key: "taboola", label: "Taboola", hint: "Account ID", icon: "t" },
];

export default function PixelsForm({ initial }: { initial: PixelConfig }) {
  const [values, setValues] = useState<PixelConfig>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      await savePixels(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
            <span className={`text-xs ${active ? "text-organic" : "text-muted"}`}>
              {active ? "● Actif" : "○ Inactif"}
            </span>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-ink px-7 py-3 text-sm font-medium text-bg hover:bg-primary-dark disabled:opacity-50"
        >
          {saved ? "Enregistré ✓" : pending ? "…" : "Enregistrer les pixels"}
        </button>
        <span className="text-xs text-muted">
          Les pixels se chargent automatiquement sur la boutique (hors admin).
        </span>
      </div>
    </div>
  );
}
