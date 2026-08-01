"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/actions/media";

/** Côté le plus long, en pixels. Au-delà, le poids ne sert plus qu'à ralentir la boutique. */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

/**
 * Redimensionne et convertit en WebP dans le navigateur avant l'envoi.
 * Une photo de 4 Mo sortie d'un téléphone tombe autour de 200 Ko sans
 * différence visible — et la fiche produit reste rapide à charger.
 */
async function optimise(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file; // format exotique : on laisse le serveur trancher
  }
}

export default function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (images: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  /** Index de la vignette en cours de déplacement. En ref : les événements de
   *  drag se suivent trop vite pour attendre un re-rendu React. */
  const from = useRef<number | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);

  const send = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setError("");
    setBusy((n) => n + list.length);

    // En série : l'ordre de la grille reste celui des fichiers choisis.
    const added: string[] = [];
    for (const file of list) {
      const form = new FormData();
      form.append("file", await optimise(file));
      const res = await uploadImage(form);
      if (res.url) added.push(res.url);
      else if (res.error) setError(res.error);
      setBusy((n) => n - 1);
    }
    if (added.length) onChange([...value, ...added]);
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const addByUrl = () => {
    const url = prompt("Adresse de l'image (https://…)");
    if (url?.trim()) onChange([...value, url.trim()]);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">
          Photos du produit
          {value.length > 1 && " — glissez pour changer l'ordre"}
        </span>
        <button type="button" onClick={addByUrl} className="text-xs text-muted hover:text-ink">
          Ajouter par URL
        </button>
      </div>

      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            setOver(false);
            void send(e.dataTransfer.files);
          }
        }}
        className={`rounded-xl border-2 border-dashed p-3 transition ${
          over ? "border-primary bg-halo/30" : "border-line bg-surface"
        }`}
      >
        {(value.length > 0 || busy > 0) && (
          <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {value.map((src, i) => (
              <div
                key={`${src}-${i}`}
                draggable
                onDragStart={(e) => {
                  from.current = i;
                  setDragged(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragEnd={() => {
                  from.current = null;
                  setDragged(null);
                  setTarget(null);
                }}
                onDragOver={(e) => {
                  if (from.current === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setTarget(i);
                }}
                onDrop={(e) => {
                  const start = from.current ?? Number(e.dataTransfer.getData("text/plain"));
                  if (!Number.isInteger(start) || start < 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  reorder(start, i);
                  from.current = null;
                  setDragged(null);
                  setTarget(null);
                }}
                className={`group relative aspect-square cursor-move overflow-hidden rounded-lg border bg-bg transition ${
                  target === i && dragged !== i
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-line"
                } ${dragged === i ? "opacity-40" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />

                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-medium text-bg">
                    Principale
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Retirer cette image"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/85 text-xs text-bg opacity-0 transition hover:bg-secondary group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}

            {Array.from({ length: busy }).map((_, i) => (
              <div
                key={`busy-${i}`}
                className="flex aspect-square animate-pulse items-center justify-center rounded-lg border border-line bg-bg text-xs text-muted"
              >
                Envoi…
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg py-6 text-center hover:bg-bg/60"
        >
          <span className="text-2xl leading-none text-muted">↑</span>
          <span className="text-sm">
            <span className="font-medium text-primary-dark">Choisir des images</span>
            <span className="text-muted"> ou glissez-les ici</span>
          </span>
          <span className="text-xs text-muted">
            JPG, PNG ou WebP — redimensionnées automatiquement
          </span>
        </button>

        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void send(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="mt-2 text-xs text-secondary">{error}</p>}
    </div>
  );
}
