"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVisit, battrePresence } from "@/lib/actions/analytics";
import { memoriserSource, sourceMemorisee } from "@/lib/cart/store";
import { store } from "@/config/store.config";

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(store.cookies.visitor);
    if (!id) {
      id =
        (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
      localStorage.setItem(store.cookies.visitor, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export default function Tracker() {
  const pathname = usePathname();
  const countRef = useRef<number>(0);
  const vidRef = useRef<string>("");
  const geoRef = useRef<{ ip?: string; city?: string }>({});
  /* Chemin courant, lu par le battement de présence sans le faire dépendre
     de `pathname` — sinon chaque navigation relancerait le minuteur. */
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  /*
    Charge utile de présence, en un seul endroit : elle part de deux points
    (le battement, et le retour de l'enregistrement de la visite) et deux
    copies divergeraient au premier champ ajouté.

    ⚠️ `memoriserSource()` est rappelé ici alors qu'il l'est déjà plus bas.
    C'est VOULU : le battement est déclaré avant l'effet qui mémorise
    l'origine, et un premier envoi trop précoce renverrait « direct » pour une
    visiteuse pourtant venue de Pinterest. L'appel est sans effet si l'origine
    est déjà connue — il ne peut donc pas écraser la première origine.
  */
  const presence = (extra?: { count?: number; ip?: string; city?: string }) => {
    memoriserSource();
    return {
      id: vidRef.current,
      path: pathRef.current,
      count: extra?.count ?? countRef.current,
      ip: extra?.ip ?? geoRef.current.ip,
      city: extra?.city ?? geoRef.current.city,
      source: sourceMemorisee(),
    };
  };

  /*
    ── BATTEMENT DE PRÉSENCE ──

    ⚠️ IL REMPLACE LE TEMPS RÉEL. Il n'y a pas de websocket ici : le
    navigateur écrit une ligne dans `<prefixe>_presence`, le back-office la
    relit. Sans battement, `since` ne bouge plus dès qu'une visiteuse reste
    sur la même page, et le tableau de bord ne peut plus distinguer
    « toujours là » de « partie ». Un onglet fermé brutalement, une coupure
    réseau ou une mise en veille n'émettent aucun signal de départ : c'est le
    silence, et lui seul, qui fait conclure au départ.

    15 s par défaut : assez fréquent pour qu'un départ se voie en moins d'une
    minute, assez rare pour rester négligeable (une requête minuscule).
  */
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    vidRef.current = vidRef.current || getVisitorId();
    battrePresence(presence()).catch(() => {});

    const battement = window.setInterval(() => {
      /* ⚠️ Onglet caché : ne rien envoyer. Sinon dix onglets oubliés en
         arrière-plan comptent pour dix visiteuses présentes. */
      if (document.visibilityState !== "visible") return;
      battrePresence(presence()).catch(() => {});
    }, store.presence.battement * 1000);

    return () => window.clearInterval(battement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    À chaque changement de page : enregistre la visite + met à jour la présence.

    ⚠️ TROIS GARDE-FOUS ANTI-ROBOTS, en plus du filtre serveur sur l'agent
    utilisateur (`lib/analytics/bots.ts`) :

    1. `navigator.webdriver` — vrai sur un navigateur piloté par Puppeteer,
       Playwright ou Selenium, y compris quand il usurpe un agent Chrome.

    2. Onglet réellement VISIBLE — écarte les préchargements spéculatifs et
       les rendus hors écran, qui n'ont jamais été des visites.

    3. Un DÉLAI de 1,2 seconde avant d'enregistrer. C'est le filtre le plus
       efficace contre les scrapeurs qui se déguisent : ils chargent, prennent
       leur instantané et repartent en quelques centaines de millisecondes,
       donc le minuteur ne se déclenche jamais. Une personne qui regarde une
       page reste, elle, largement au-delà.

    Coût de ce délai : une visiteuse qui quitte en moins de 1,2 s n'est pas
    comptée. C'est assumé — un rebond aussi rapide n'est pas une visite, et
    mieux vaut sous-compter honnêtement que gonfler le taux de conversion.
  */
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    // Avant tout filtrage : l'origine se lit sur la page d'ARRIVÉE.
    memoriserSource();
    if (typeof navigator !== "undefined" && navigator.webdriver) return;

    let annule = false;

    const enregistrer = () => {
      if (annule || document.visibilityState !== "visible") return;
      const vid = vidRef.current || (vidRef.current = getVisitorId());
      trackVisit(pathname, document.referrer || undefined, vid, sourceMemorisee())
        .then((res) => {
          if (annule) return;
          countRef.current = res.count;
          geoRef.current = { ip: res.ip, city: res.city };
          /* L'IP et la ville ne sont connues qu'ici : le battement suivant
             les porterait, mais quinze secondes plus tard. */
          return battrePresence(
            presence({ count: res.count, ip: res.ip, city: res.city }),
          );
        })
        .catch(() => {});
    };

    const minuteur = window.setTimeout(enregistrer, 1200);
    return () => {
      annule = true;
      window.clearTimeout(minuteur);
    };
  }, [pathname]);

  return null;
}
