"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand.config";
import { payMollie, type CheckoutDraft } from "@/lib/actions/checkout";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Mollie?: (
      profileId: string,
      options: { locale?: string; testmode?: boolean },
    ) => any;
  }
}

/** Déclenche le paiement avec la carte déjà saisie dans le widget. */
export type MollieConfirm = (
  draft: CheckoutDraft,
) => Promise<{ error?: string; handled?: true; orderId?: string }>;

const SDK_URL = "https://js.mollie.com/v1/mollie.js";
const CONTAINER_ID = "mollie-card";

let sdk: Promise<void> | null = null;

/** Charge mollie.js une seule fois par page. */
function loadMollieSdk(): Promise<void> {
  if (sdk) return sdk;
  sdk = new Promise<void>((resolve, reject) => {
    if (window.Mollie) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Impossible de charger le paiement Mollie")),
    );
    if (!existing) {
      script.src = SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return sdk;
}

/**
 * Champs carte Mollie Components.
 *
 * Les champs sont des IFRAMES servies par Mollie : le numéro de carte ne
 * touche jamais nos serveurs, la boutique reste en PCI SAQ-A. Le navigateur
 * échange la saisie contre un `cardToken` que seule notre clé API peut
 * ensuite utiliser.
 *
 * ⚠️ Le 3-D Secure se fait chez Mollie, par redirection. `confirm` renvoie
 * donc `handled: true` après avoir lancé la navigation : le tunnel ne doit ni
 * vider le panier ni afficher de confirmation à ce moment-là — c'est
 * `/api/mollie/return` qui tranchera.
 *
 * ⚠️ Le conteneur ne doit JAMAIS être masqué ni recouvert pendant le montage :
 * un composant Mollie initialisé dans un élément de taille nulle reste vide.
 */
export default function MollieCard({
  profileId,
  testmode,
  onReady,
  onUnavailable,
}: {
  profileId: string;
  testmode: boolean;
  onReady: (confirm: MollieConfirm) => void;
  onUnavailable: (reason: string) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const mollieRef = useRef<any>(null);
  const componentRef = useRef<any>(null);

  const confirm = useCallback<MollieConfirm>(async (draft) => {
    const mollie = mollieRef.current;
    if (!mollie) return { error: "Le paiement n'est pas prêt." };

    const { token, error } = await mollie.createToken();
    if (error) {
      return {
        error:
          error.message ?? "Vérifiez les informations de votre carte.",
      };
    }
    if (!token) return { error: "Veuillez saisir une carte valide." };

    const res = await payMollie(token, draft);
    if (res.error) return { error: res.error };
    if (res.orderId) return { orderId: res.orderId };
    if (res.redirectUrl) {
      // Mollie prend la main pour le 3-D Secure.
      window.location.href = res.redirectUrl;
      return { handled: true };
    }
    return { error: "Mollie : réponse inattendue." };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        await loadMollieSdk();
        if (cancelled || !window.Mollie) return;

        const mollie = window.Mollie(profileId, {
          locale: brand.locale.replace("-", "_"),
          testmode,
        });
        mollieRef.current = mollie;

        const card = mollie.createComponent("card");
        card.mount(`#${CONTAINER_ID}`);
        componentRef.current = card;

        if (cancelled) return;
        setStatus("ready");
        onReady(confirm);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        onUnavailable(
          e instanceof Error ? e.message : "Paiement Mollie indisponible.",
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        componentRef.current?.unmount?.();
      } catch {
        // Démontage best-effort : une erreur ici ne doit pas casser la page.
      }
    };
    // `confirm` est stable (useCallback sans dépendance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, testmode]);

  return (
    <div>
      <div id={CONTAINER_ID} className="min-h-[3.25rem]" />
      {status === "loading" && (
        <p className="mt-3 text-xs text-muted">Chargement du paiement…</p>
      )}
      <p className="mt-3 text-xs text-muted">
        Paiement chiffré par Mollie · vos données carte ne transitent jamais par
        ce site.
      </p>
    </div>
  );
}
