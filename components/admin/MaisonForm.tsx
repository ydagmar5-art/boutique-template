"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMaison } from "@/lib/actions/storefront";
import { uploadImage } from "@/lib/actions/media";

/**
 * Rédaction du bloc « La Maison » de l'accueil : titre, texte et visuel.
 *
 * C'est la seule page du site où la marque se raconte — elle devait pouvoir
 * être réécrite sans déploiement, y compris depuis un téléphone.
 *
 * ⚠️ Aucune sauvegarde automatique. Le texte est long, on s'y reprend à
 * plusieurs fois, et un enregistrement déclenché à chaque frappe publierait
 * des phrases inachevées sur la page d'accueil.
 */

/** Côté le plus long, en pixels — au-delà, le poids ne fait que ralentir la page. */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

/** Redimensionne et convertit en WebP dans le navigateur avant l'envoi. */
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
    return file; // format exotique : le serveur tranchera
  }
}

export interface MaisonValues {
  titre: string;
  texte: string;
  image: string;
  alt: string;
}

export default function MaisonForm({ initial }: { initial: MaisonValues }) {
  const router = useRouter();
  const [v, setV] = useState<MaisonValues>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const champ = <K extends keyof MaisonValues>(cle: K, valeur: MaisonValues[K]) => {
    setV((prev) => ({ ...prev, [cle]: valeur }));
    setSaved(false);
  };

  /* Vrai dès qu'une saisie n'est pas encore en base. Sans ce repère, un texte
     tapé mais jamais soumis donne l'illusion d'être en ligne. */
  const modifie =
    v.titre !== initial.titre ||
    v.texte !== initial.texte ||
    v.image !== initial.image ||
    v.alt !== initial.alt;

  const paragraphes = v.texte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  const envoyer = async (file: File) => {
    setErreur("");
    setEnvoi(true);
    const form = new FormData();
    form.append("file", await optimise(file));
    const res = await uploadImage(form);
    setEnvoi(false);
    if (res.url) champ("image", res.url);
    else setErreur(res.error ?? "L'envoi a échoué.");
  };

  const enregistrer = () =>
    start(async () => {
      setErreur("");
      try {
        await setMaison(v);
        setSaved(true);
        router.refresh();
        window.setTimeout(() => setSaved(false), 2500);
      } catch {
        // Sans ce message, un échec est INVISIBLE : le champ garde le texte
        // saisi, l'écran paraît normal, et l'accueil reste sur l'ancienne
        // version sans que personne ne s'en aperçoive.
        setErreur("Enregistrement impossible. Vérifiez la connexion et réessayez.");
      }
    });

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">La Maison</h2>
          <p className="mt-0.5 text-xs text-muted">
            Le bloc qui raconte la marque sur la page d&apos;accueil.
          </p>
        </div>
        {modifie && !pending && (
          <span className="shrink-0 text-xs text-primary-dark">
            ● Non enregistré
          </span>
        )}
        {pending && <span className="shrink-0 text-xs text-muted">Enregistrement…</span>}
        {saved && !pending && !modifie && (
          <span className="shrink-0 text-xs text-organic">Enregistré</span>
        )}
      </div>

      <div className="mt-5 space-y-5">
        {/* ─── TITRE ─── */}
        <div>
          <label htmlFor="maison-titre" className="text-xs font-medium text-muted">
            Titre
          </label>
          <textarea
            id="maison-titre"
            value={v.titre}
            onChange={(e) => champ("titre", e.target.value)}
            rows={2}
            className="mt-1 w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-2.5 font-heading text-lg font-light outline-none focus:border-primary"
          />
          <p className="mt-1 text-[0.7rem] text-muted">
            Appuyez sur Entrée pour couper le titre en deux lignes — la coupure
            est conservée telle quelle sur le site.
          </p>
        </div>

        {/* ─── TEXTE ─── */}
        <div>
          <label htmlFor="maison-texte" className="text-xs font-medium text-muted">
            Texte
          </label>
          <textarea
            id="maison-texte"
            value={v.texte}
            onChange={(e) => champ("texte", e.target.value)}
            rows={14}
            className="mt-1 w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm leading-[1.8] outline-none focus:border-primary"
          />
          <p className="mt-1 text-[0.7rem] text-muted">
            Laissez une ligne vide entre deux paragraphes —{" "}
            {paragraphes} paragraphe{paragraphes > 1 ? "s" : ""} pour l&apos;instant.
          </p>
        </div>

        {/* ─── IMAGE ─── */}
        <div>
          <span className="text-xs font-medium text-muted">Image</span>
          <div className="mt-1 flex items-start gap-4">
            <div className="h-32 w-[102px] shrink-0 overflow-hidden rounded-xl border border-line bg-bg">
              {v.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={v.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center px-2 text-center text-[0.65rem] text-muted">
                  Aucune image
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/*"
                disabled={envoi}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void envoyer(f);
                  e.target.value = ""; // permet de renvoyer le même fichier
                }}
                className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:text-bg hover:file:bg-primary-dark disabled:opacity-50"
              />
              {envoi && <p className="text-xs text-muted">Envoi en cours…</p>}

              <input
                value={v.alt}
                onChange={(e) => champ("alt", e.target.value)}
                placeholder="Description de l'image"
                className="w-full rounded-xl border border-line bg-bg px-3.5 py-2 text-sm outline-none focus:border-primary"
              />
              <p className="text-[0.7rem] text-muted">
                Cette description est lue à voix haute aux personnes
                malvoyantes, et s&apos;affiche si l&apos;image ne charge pas.
              </p>

              {v.image && (
                <button
                  type="button"
                  onClick={() => champ("image", "")}
                  className="text-xs text-muted underline underline-offset-4 hover:text-ink"
                >
                  Retirer l&apos;image
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
        <button
          onClick={enregistrer}
          disabled={pending || envoi}
          className="rounded-full bg-ink px-7 py-3 text-sm font-medium text-bg transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
        <span className="text-xs text-muted">
          {modifie
            ? "Vos modifications ne sont pas encore en ligne."
            : "La page d'accueil est à jour."}
        </span>
      </div>

      {erreur && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
    </div>
  );
}
