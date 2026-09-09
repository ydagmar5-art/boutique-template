"use client";

import { useEffect, useRef, useState } from "react";
import { presenceEnLigne } from "@/lib/actions/analytics";
import { store } from "@/config/store.config";
import { SOURCE_LABEL, type SourceVente } from "@/lib/attribution";
import { amorcer, etatAudio, jouerCarillon, type EtatAudio } from "@/components/admin/carillon";

/** Au-delà, une visiteuse est considérée partie — 3 battements manqués. */
const PERIME = store.presence.perime * 1000;

/**
 * Cadence de relecture de la table de présence.
 *
 * ⚠️ Doit rester nettement inférieure au battement du Tracker (15 s), sinon
 * une visiteuse arrivée juste après un sondage n'apparaît qu'une demi-minute
 * plus tard — et le carillon sonne pour quelqu'un qui est déjà reparti.
 */
const SONDAGE = 8_000;

interface Online {
  id: string;
  path: string;
  count: number;
  since: number;
  ip?: string;
  city?: string;
  /* Origine PREMIÈRE de la visiteuse, mémorisée à son arrivée — la même clé
     que celle attribuée aux ventes, pour que les deux écrans se recoupent.
     Absente pour les visiteuses connectées avant ce correctif. */
  source?: string;
}

export default function LiveVisitors() {
  const [online, setOnline] = useState<Online[]>([]);
  const [connected, setConnected] = useState(false);
  const [son, setSon] = useState(false);

  /*
    Visiteuses déjà annoncées, avec l'instant où on les a vues pour la
    dernière fois. ⚠️ Ce n'est pas un simple Set : un rechargement de page
    fait sortir puis rentrer la même clé de présence, ce qui sonnerait deux
    fois. On ne resonne donc qu'après un vrai silence (cf. `OUBLI`).
  */
  const vues = useRef<Map<string, number>>(new Map());
  /* La toute première synchronisation ne sonne pas : sinon ouvrir le tableau
     de bord déclencherait une salve pour tout le monde déjà en ligne. */
  const premiereSync = useRef(true);
  const sonRef = useRef(false);
  sonRef.current = son;
  /* État réel du son, affiché sur la cloche : sans ça, un carillon bloqué par
     le navigateur est indiscernable d'un carillon qui n'a pas été déclenché. */
  const [audio, setAudio] = useState<EtatAudio>("vierge");
  /* Horodatage du dernier déclenchement — même si le son n'est pas sorti.
     C'est ce qui permet de distinguer les deux pannes possibles. */
  const [dernier, setDernier] = useState<number | null>(null);

  // Préférence conservée d'une session à l'autre.
  useEffect(() => {
    try {
      setSon(localStorage.getItem(`${store.prefix}_carillon`) === "1");
    } catch {
      /* navigation privée */
    }
  }, []);

  /*
    ⚠️ LA RAISON POUR LAQUELLE LE SON NE PARTAIT PAS TOUJOURS.
    Quand la préférence est restaurée depuis le stockage, aucun clic n'a eu
    lieu : le contexte audio reste suspendu et `jouerCarillon()` sort en
    silence, sans erreur. On le réveille donc au tout premier geste fait sur
    la page, quel qu'il soit.
  */
  useEffect(() => {
    /* ⚠️ À CHAQUE geste, pas une seule fois : si le tout premier clic a eu
       lieu avant le montage, ou si le navigateur l'a refusé, les suivants
       doivent pouvoir rattraper. C'est sans coût une fois amorcé. */
    const debloquer = () => {
      amorcer();
      setAudio(etatAudio());
    };
    document.addEventListener("pointerdown", debloquer, true);
    document.addEventListener("keydown", debloquer, true);
    const veille = window.setInterval(() => setAudio(etatAudio()), 3000);
    return () => {
      document.removeEventListener("pointerdown", debloquer, true);
      document.removeEventListener("keydown", debloquer, true);
      window.clearInterval(veille);
    };
  }, []);

  useEffect(() => {
    let vivant = true;

    /*
      ── SONDAGE, ET NON TEMPS RÉEL ──

      Il n'y a pas de websocket : le navigateur de chaque visiteuse écrit un
      battement en base, celui-ci relit la table. La conséquence à connaître :
      une arrivée se voit avec au plus SONDAGE de retard, jamais instantanément.

      ⚠️ Ce sont les lignes PÉRIMÉES qui font partir une visiteuse, pas un
      événement de départ — un onglet fermé brutalement, une veille ou une
      coupure réseau n'en émettent aucun. Trois battements manqués suffisent.
    */
    const sync = async () => {
      let liste: Online[];
      try {
        liste = (await presenceEnLigne()) as Online[];
      } catch {
        /* Réseau coupé ou session expirée : on garde l'affichage précédent
           plutôt que de vider la liste, ce qui se lirait comme « plus
           personne sur la boutique ». */
        return;
      }
      if (!vivant) return;
      setConnected(true);

      const vivantes = liste
        .filter((v) => Date.now() - v.since < PERIME)
        .sort((a, b) => b.since - a.since);

      /* Une visiteuse est « nouvelle » si on ne l'a pas vue depuis OUBLI.
         ⚠️ Aligné sur PERIME : quelqu'un écarté de la liste puis revenu doit
         compter comme une arrivée, sinon son retour serait muet. */
      const OUBLI = PERIME;
      const maintenant = Date.now();
      let nouvelles = 0;
      for (const v of vivantes) {
        const derniere = vues.current.get(v.id);
        if (derniere === undefined || maintenant - derniere > OUBLI) nouvelles += 1;
        vues.current.set(v.id, maintenant);
      }
      // Purge des clés anciennes, pour que la mémoire ne gonfle pas.
      for (const [id, t] of vues.current) {
        if (maintenant - t > OUBLI * 10) vues.current.delete(id);
      }

      if (premiereSync.current) premiereSync.current = false;
      // Une seule note même si plusieurs arrivent ensemble : dix carillons
      // d'affilée seraient insupportables.
      else if (nouvelles > 0 && sonRef.current) {
        jouerCarillon();
        setDernier(Date.now());
        setAudio(etatAudio());
      }

      setOnline(vivantes);
    };

    sync();
    const balayage = window.setInterval(sync, SONDAGE);

    return () => {
      vivant = false;
      window.clearInterval(balayage);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-primary/40 bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full ${online.length ? "animate-ping bg-organic opacity-75" : ""}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online.length ? "bg-organic" : "bg-line"}`} />
          </span>
          <h2 className="font-medium">Visiteurs en direct</h2>
        </div>
        <div className="flex items-center gap-3">
          {/*
            Ce bouton sert deux fois : il enregistre la préférence ET fournit
            le geste utilisateur sans lequel le navigateur refuse tout son.
          */}
          <button
            type="button"
            onClick={() => {
              const suivant = !son;
              setSon(suivant);
              try {
                localStorage.setItem(`${store.prefix}_carillon`, suivant ? "1" : "0");
              } catch {
                /* navigation privée */
              }
              if (suivant) {
                amorcer(); // doit rester dans le geste, sans await avant
                jouerCarillon(); // aperçu immédiat, pour entendre ce qu'on active
                setAudio(etatAudio());
              }
            }}
            aria-pressed={son}
            title={son ? "Couper le carillon" : "Sonner à chaque nouvelle visiteuse"}
            className={`rounded-full border p-2 transition ${
              son
                ? "border-organic/40 bg-organic/10 text-organic"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            <Cloche actif={son} />
            <span className="sr-only">
              {son ? "Carillon activé" : "Carillon coupé"}
            </span>
          </button>
          <span className="font-heading text-2xl">{online.length}</span>
        </div>
      </div>

      {!connected ? (
        <p className="text-sm text-muted">Relevé en cours…</p>
      ) : online.length === 0 ? (
        <p className="text-sm text-muted">Personne sur la boutique en ce moment.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {online.map((v, i) => (
            <li key={i} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-halo text-[10px] font-medium text-primary-dark">
                  {v.id.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-ink">{v.path}</span>
                  <span className="block text-xs text-muted">
                    {v.city || "Ville inconnue"} · {v.ip || "IP inconnue"}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                <Origine source={v.source} />
                {v.count > 1 ? `${v.count}ᵉ visite` : "1ʳᵉ visite"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Actualisé toutes les {Math.round(SONDAGE / 1000)} secondes — la page
        qu&apos;ils regardent en ce moment.
      </p>
      {son && (
        <p className="mt-1 text-xs text-muted">
          {audio === "refuse"
            ? "Son bloqué par le navigateur — cliquez n'importe où sur la page."
            : audio === "actif"
              ? "Carillon prêt."
              : "Carillon en attente d'un clic sur la page."}
          {dernier && ` Dernier déclenchement à ${new Date(dernier).toLocaleTimeString("fr-FR")}.`}
        </p>
      )}
    </div>
  );
}

/**
 * Pastille d'origine.
 *
 * ⚠️ Chaque canal a sa couleur, et elles ne sont pas décoratives : c'est ce
 * qui permet de lire la provenance du trafic d'un seul coup d'œil quand
 * plusieurs campagnes tournent en même temps. La couleur ne porte JAMAIS
 * l'information seule — le nom du canal est toujours écrit à côté.
 */
const TEINTES: Partial<Record<SourceVente, string>> = {
  pinterest: "bg-red-50 text-red-700 border-red-200",
  snapchat: "bg-yellow-50 text-yellow-800 border-yellow-300",
  instagram: "bg-pink-50 text-pink-700 border-pink-200",
  facebook: "bg-blue-50 text-blue-700 border-blue-200",
  tiktok: "bg-neutral-100 text-neutral-800 border-neutral-300",
  google: "bg-emerald-50 text-emerald-700 border-emerald-200",
  publicite: "bg-violet-50 text-violet-700 border-violet-200",
  ia: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

function Origine({ source }: { source?: string }) {
  // Visiteuse arrivée avant le déploiement : on n'invente pas une origine.
  if (!source) return null;
  const cle = source as SourceVente;
  const libelle = SOURCE_LABEL[cle] ?? source;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[0.65rem] ${
        TEINTES[cle] ?? "border-line text-muted"
      }`}
      title={`Origine : ${libelle}`}
    >
      {libelle}
    </span>
  );
}

/** Cloche — tracé vectoriel, jamais un émoji (consigne de marque). */
function Cloche({ actif }: { actif: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      {!actif && <path d="M3 3l18 18" />}
    </svg>
  );
}
