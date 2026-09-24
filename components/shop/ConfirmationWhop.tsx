"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { commandeDeLaSession, finaliserWhopElements, rattraperSessionWhop } from "@/lib/actions/checkout";
import { useCart } from "@/lib/cart/store";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  RETOUR DE WHOP ELEMENTS — attendre la commande, puis l'ouvrir   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Whop n'appelle plus la page quand le paiement aboutit : il y RENVOIE la
 * cliente. La commande, elle, naît du webhook (2 s environ). On demande donc
 * au serveur toutes les 1,5 s si elle existe, et on l'ouvre dès qu'elle est là.
 *
 * ⚠️ Si le webhook tarde, on va chercher le paiement directement chez Whop
 * (`rattraperSessionWhop`) à 8 s, 25 s puis 50 s. Une cliente débitée finit
 * toujours sur sa confirmation — sans jamais dépendre d'un seul messager.
 *
 * ⚠️ Au bout de 90 s sans commande, on ne dit JAMAIS « paiement refusé » : on
 * dit de ne pas repayer, et on propose de revenir au paiement si elle n'a pas
 * été débitée. Un faux « refusé » a coûté un double paiement le 20/09.
 */
const ECHEC = new Set(["error", "failed", "failure", "canceled", "cancelled"]);

export default function ConfirmationWhop({
  sessionId,
  paymentId,
  statut,
}: {
  sessionId: string;
  /** `pay_…` quand la banque renvoie la cliente avec la référence du paiement. */
  paymentId: string;
  statut: string;
}) {
  const clear = useCart((s) => s.clear);
  const [attenteLongue, setAttenteLongue] = useState(false);
  /* Refus CONFIRMÉ par Whop (relu côté serveur) — jamais supposé. */
  const [refus, setRefus] = useState("");
  const echecAnnonce = ECHEC.has(statut);

  useEffect(() => {
    if (!sessionId) {
      setAttenteLongue(true);
      return;
    }
    let arrete = false;
    const debut = Date.now();
    const rattrapages = [8_000, 25_000, 50_000];

    const ouvrir = (orderId: string) => {
      arrete = true;
      clear();
      window.location.replace(`/order/${orderId}`);
    };

    const battement = async () => {
      if (arrete) return;
      const ecoule = Date.now() - debut;
      try {
        let { orderId } = await commandeDeLaSession(sessionId);
        /* Retour de 3-D Secure avec la référence : on relit le paiement chez
           Whop et on crée la commande tout de suite. */
        if (!orderId && paymentId) {
          const f = await finaliserWhopElements(sessionId, paymentId);
          if (f.error) {
            arrete = true;
            setRefus(f.error);
            return;
          }
          orderId = f.orderId;
        }
        if (!orderId && rattrapages.length && ecoule >= rattrapages[0]) {
          rattrapages.shift();
          ({ orderId } = await rattraperSessionWhop(sessionId));
        }
        if (orderId) return ouvrir(orderId);
      } catch {
        /* réseau capricieux : on retentera au prochain battement */
      }
      if (ecoule > 90_000) setAttenteLongue(true);
      if (ecoule < 10 * 60 * 1000 && !arrete) setTimeout(battement, 1500);
    };
    battement();
    return () => {
      arrete = true;
    };
  }, [sessionId, paymentId, clear]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
      {refus ? (
        <>
          <h1 className="font-heading text-2xl">Le paiement n&apos;a pas abouti</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{refus}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">Vous n&apos;avez pas été débitée. Votre panier est conservé.</p>
          <Link href="/checkout" className="mt-6 inline-flex rounded-full bg-ink px-8 py-3 text-sm font-medium text-bg">
            Réessayer le paiement
          </Link>
        </>
      ) : !attenteLongue ? (
        <>
          <span
            className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-ink"
            aria-hidden
          />
          <h1 className="mt-8 font-heading text-2xl">
            {echecAnnonce ? "Vérification de votre paiement…" : "Finalisation de votre commande"}
          </h1>
          <p role="status" className="mt-3 text-sm leading-relaxed text-muted">
            Ne fermez pas cette page : votre confirmation s&apos;affiche dans
            quelques secondes.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl">Nous vérifions votre paiement</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Si votre banque a validé le paiement, <strong>ne payez pas une seconde fois</strong> :
            votre commande sera confirmée par e-mail dans quelques minutes. Cette
            page s&apos;ouvrira aussi d&apos;elle-même dès qu&apos;elle sera prête.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Vous n&apos;avez pas été débitée ?
          </p>
          <Link
            href="/checkout"
            className="mt-6 inline-flex rounded-full bg-ink px-8 py-3 text-sm font-medium text-bg"
          >
            Revenir au paiement
          </Link>
        </>
      )}
    </section>
  );
}
