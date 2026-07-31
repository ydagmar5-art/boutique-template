"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Square?: any;
  }
}

function loadSdk(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Square) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK Square")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Impossible de charger Square"));
    document.head.appendChild(s);
  });
}

/** Coordonnées de l'acheteur, exigées par Square pour l'authentification forte. */
export interface SquareBuyer {
  /** Montant en CENTIMES. */
  amount: number;
  currency: string;
  givenName: string;
  familyName: string;
  email: string;
  addressLines: string[];
  city: string;
  postalCode: string;
  countryCode: string;
}

export type SquareConfirm = (buyer: SquareBuyer) => Promise<{
  token?: string;
  /** Preuve d'authentification 3-D Secure à joindre au débit. */
  verificationToken?: string;
  error?: string;
}>;

/**
 * Champ carte Square embarqué (iframe). Le paiement se saisit sur le site,
 * Square tokenise la carte, puis `verifyBuyer` déclenche le 3-D Secure ;
 * `onReady` fournit la fonction qui enchaîne les deux.
 */
export default function SquareCard({
  applicationId,
  locationId,
  sandbox,
  onReady,
}: {
  applicationId: string;
  locationId: string;
  sandbox: boolean;
  onReady: (confirm: SquareConfirm) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let card: any;
    let cancelled = false;
    const src = sandbox
      ? "https://sandbox.web.squarecdn.com/v1/square.js"
      : "https://web.squarecdn.com/v1/square.js";

    (async () => {
      try {
        await loadSdk(src);
        if (cancelled || !window.Square) return;
        const payments = window.Square.payments(applicationId, locationId);
        card = await payments.card();
        await card.attach(containerRef.current);
        if (cancelled) return;
        setStatus("ready");
        onReady(async (buyer) => {
          const result = await card.tokenize();
          if (result.status !== "OK") {
            return { error: "Carte invalide, vérifiez les informations." };
          }
          const token = result.token as string;

          // 3-D Secure / SCA — OBLIGATOIRE en Europe. Sans ce jeton de
          // vérification, la banque de l'acheteur refuse le paiement ou la
          // responsabilité de la fraude reste à la charge du commerçant.
          // Square affiche lui-même le défi dans une fenêtre modale.
          try {
            const verification = await payments.verifyBuyer(token, {
              amount: (buyer.amount / 100).toFixed(2),
              currencyCode: buyer.currency,
              intent: "CHARGE",
              billingContact: {
                givenName: buyer.givenName,
                familyName: buyer.familyName,
                email: buyer.email,
                addressLines: buyer.addressLines,
                city: buyer.city,
                postalCode: buyer.postalCode,
                countryCode: buyer.countryCode,
              },
            });
            return { token, verificationToken: verification?.token };
          } catch {
            // Défi abandonné ou échoué : on n'encaisse pas.
            return {
              error:
                "Authentification bancaire non aboutie. Réessayez ou utilisez une autre carte.",
            };
          }
        });
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "Erreur Square");
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        card?.destroy?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, locationId, sandbox]);

  return (
    <div>
      <div className="rounded-xl border border-line bg-surface p-4">
        <span className="mb-2 block text-xs font-medium text-muted">
          Carte bancaire
        </span>
        <div ref={containerRef} className="min-h-[44px]" />
        {status === "loading" && (
          <p className="mt-2 text-xs text-muted">Chargement du paiement sécurisé…</p>
        )}
      </div>
      {message && <p className="mt-2 text-sm text-secondary">{message}</p>}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span>🔒</span>
        Paiement chiffré par Square · vos données carte ne transitent jamais par
        notre site.
      </p>
    </div>
  );
}
