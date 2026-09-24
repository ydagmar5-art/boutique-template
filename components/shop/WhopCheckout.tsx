"use client";

import { useEffect, useRef, useState } from "react";
import { loadWhop } from "@whop/elements";
import type { PaymentsHandle } from "@whop/elements/payments";
import {
  commandeDeLaSession,
  demarrerWhop,
  finaliserWhopElements,
  payerWhopElements,
} from "@/lib/actions/checkout";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import { useCart } from "@/lib/cart/store";
import { messageWhop } from "@/lib/payments/messages-whop";
import type { OrderItem } from "@/lib/db/seed";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  WHOP ELEMENTS — champs de carte seuls, NOTRE bouton « Payer »   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ WHOP ELEMENTS depuis le 24/09/2026 : l'ancien module (`js.whop.com/.../loader.js`,
 * `data-whop-checkout-*`, `wco.submit`) est coupé par Whop le 21/10/2026.
 *
 * ⚠️ POURQUOI PAS le module « checkout » tout fait de Whop Elements : essayé
 * le 24/09, il redemandait nom et adresse de facturation (impossible à
 * pré-remplir) et affichait le prix dans la devise du visiteur — hors de France
 * (dirhams depuis le Maroc). Refusé en production.
 *
 * Ici, on n'emprunte à Whop QUE le moyen de paiement (élément « payment »,
 * facturation masquée). Le parcours :
 *   1. le tunnel est rempli → le serveur crée un plan EUR au prix du panier
 *      (`demarrerWhop`) ;
 *   2. « Payer » → Whop transforme la carte en jeton (`createConfirmationToken`)
 *      avec le nom, l'adresse et l'e-mail de NOTRE formulaire ;
 *   3. le serveur débite le plan avec ce jeton (`payerWhopElements`) ;
 *   4. 3-D Secure éventuel → `handleNextAction` (fenêtre de la banque) ;
 *   5. le serveur relit le paiement chez Whop et crée la commande.
 *
 * La carte ne touche jamais nos serveurs : PCI DSS SAQ-A, comme avant.
 */

type Resultat = { orderId?: string; error?: string; handled?: true };

export default function WhopCheckout({
  items,
  promoCode,
  formValide,
  getDraft,
  onReady,
  onUnavailable,
}: {
  items: OrderItem[];
  promoCode?: string;
  /** Coordonnées complètes dans le tunnel — condition du montage. */
  formValide?: boolean;
  /** Brouillon saisi dans le tunnel, ou `null` s'il est incomplet. */
  getDraft?: () => CheckoutDraft | null;
  onReady: (confirm: (draft: CheckoutDraft) => Promise<Resultat>) => void;
  onUnavailable: (raison: string) => void;
}) {
  const clear = useCart((s) => s.clear);
  const zoneCarte = useRef<HTMLDivElement | null>(null);
  const zoneMarque = useRef<HTMLDivElement | null>(null);
  const [session, setSession] = useState<{ sessionId: string; accountId: string; total: number } | null>(null);
  const [pret, setPret] = useState(false);
  /*
    ⚠️ La cliente doit SAVOIR qu'il se passe quelque chose (incident réel :
    faute de le savoir, une cliente a repayé).
    Vrai depuis l'appui sur « Payer » jusqu'à la confirmation ou l'erreur.
  */
  const [verification, setVerification] = useState(false);
  /* Relance une session neuve, une seule fois, si le module plante au chargement. */
  const [tentative, setTentative] = useState(0);
  /* Toutes les sessions de la visite : l'encaissement peut viser n'importe laquelle. */
  const sessionsVues = useRef<string[]>([]);

  const empreintePanier = JSON.stringify(items.map((i) => [i.slug, i.variantId, i.qty])) + (promoCode ?? "");

  /* Jamais plus de trois minutes de bandeau, quoi qu'il arrive. */
  useEffect(() => {
    if (!verification) return;
    const t = setTimeout(() => setVerification(false), 185_000);
    return () => clearTimeout(t);
  }, [verification]);

  /* ── 1. Session serveur : plan EUR au prix exact du panier ── */
  useEffect(() => {
    let abandonne = false;
    if (!items.length) return;
    /* Montage différé : l'e-mail et l'adresse du brouillon sont la clé de
       rapprochement du webhook et du rattrapage. */
    const draft = formValide ? getDraft?.() ?? null : null;
    if (!draft) {
      setSession(null);
      return;
    }
    setSession(null);
    setPret(false);
    demarrerWhop({ ...draft, items, total: 0, promoCode })
      .then((r) => {
        if (abandonne) return;
        if (r.error || !r.sessionId || !r.accountId || !r.total) {
          onUnavailable(r.error ?? "Whop n'a pas pu préparer le paiement.");
          return;
        }
        if (!sessionsVues.current.includes(r.sessionId)) sessionsVues.current.push(r.sessionId);
        setSession({ sessionId: r.sessionId, accountId: r.accountId, total: r.total });
      })
      .catch(() => {
        if (!abandonne) onUnavailable("Whop est injoignable.");
      });
    return () => {
      abandonne = true;
    };
    /* `formValide` mais PAS le brouillon : une correction d'adresse ne refait
       pas de session. L'adresse qui fait foi est celle de la commande. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreintePanier, formValide, tentative]);

  /* ── 2. Monter les champs de carte, brancher « Payer » ── */
  useEffect(() => {
    if (!session || !zoneCarte.current) return;
    let fini = false;
    let paiements: PaymentsHandle | null = null;
    const retour = `${window.location.origin}/checkout/confirmation?s=${encodeURIComponent(session.sessionId)}`;

    loadWhop()
      .then((WhopElements) => {
        if (fini || !zoneCarte.current) return;
        const whop = WhopElements({
          locale: "fr",
          appearance: { theme: { appearance: "light", accentColor: "gray", grayColor: "sand" } },
        });
        /* ⚠️ Devise et montant FIXÉS en euros : ils filtrent les moyens
           proposés. Le débit, lui, se fait côté serveur sur le plan EUR. */
        paiements = whop.payments.create({
          accountId: session.accountId,
          currency: "eur",
          amount: session.total,
          /* ⚠️ CARTE (+ Apple Pay / Google Pay) UNIQUEMENT. Whop proposait aussi
             virement bancaire, Bancontact, Mobile Pay : un virement met des
             jours à arriver, la commande resterait en suspens. */
          paymentMethodConfiguration: {
            enabled: ["card", "apple_pay", "google_pay"],
            disabled: ["crypto"],
            include_platform_defaults: false,
          },
          returnUrl: retour,
        });
        const carte = paiements.create("payment", {
          /* ⚠️ Facturation MASQUÉE : nom, adresse, téléphone viennent de
             NOTRE formulaire, passés au jeton ci-dessous. */
          fields: { billingDetails: "never", phone: "never" },
          onReady: () => setPret(true),
          onError: (e) => {
            console.warn("[whop elements]", e?.code, e?.message);
            if (fini) return;
            if (tentative < 1) setTentative((n) => n + 1);
            else onUnavailable("Le module de paiement Whop n'a pas pu se charger.");
          },
        });
        carte.mount(zoneCarte.current);
        /* Mention de Whop (marchand de référence) exigée à côté des champs. */
        if (zoneMarque.current) paiements.create("branding").mount(zoneMarque.current);

        const handle = paiements;
        onReady(async (draft): Promise<Resultat> => {
          setVerification(true);
          const echec = (message: string): Resultat => {
            setVerification(false);
            return { error: message };
          };
          try {
            /* a. Carte → jeton, avec l'identité saisie dans le tunnel. */
            let jeton: string;
            try {
              const r = await handle.createConfirmationToken({
                billingDetails: {
                  email: draft.email,
                  name: draft.customer,
                  phone: draft.phone || undefined,
                  address: {
                    line1: draft.street || draft.address,
                    city: draft.city,
                    postal_code: draft.zip,
                    country: draft.country || "FR",
                  },
                },
              });
              jeton = r.confirmationToken;
            } catch (e) {
              return echec(
                messageWhop(
                  e instanceof Error ? e.message : "",
                  "Les informations de votre carte sont incomplètes ou invalides. Vérifiez le numéro, la date d'expiration et le code.",
                ),
              );
            }

            /* b. Débit côté serveur, sur le plan EUR de la session. */
            const r = await payerWhopElements({ sessionId: session.sessionId, confirmationToken: jeton });
            if (r.orderId) return { orderId: r.orderId };
            if (r.error) return echec(r.error);

            /* c. 3-D Secure / étape bancaire. */
            if (r.clientSecret) {
              const etape = await whop.payments.handleNextAction({ clientSecret: r.clientSecret, returnUrl: retour });
              /* Page de la banque en plein écran : la cliente reviendra sur
                 /checkout/confirmation, qui finit le travail. */
              if (etape.redirected) return { handled: true };
              const st = String(etape.status || "").toLowerCase();
              if (etape.lastPaymentError || ["failed", "canceled", "requires_payment_method"].includes(st)) {
                return echec(messageWhop(etape.lastPaymentError?.message ?? etape.lastPaymentError?.code));
              }
            }

            /* d. Paiement abouti (ou en cours) : le serveur relit chez Whop. */
            if (r.paymentId) {
              for (let i = 0; i < 6; i++) {
                const f = await finaliserWhopElements(session.sessionId, r.paymentId);
                if (f.orderId) return { orderId: f.orderId };
                if (f.error) return echec(f.error);
                await new Promise((ok) => setTimeout(ok, 1500));
              }
            }
            /* Toujours rien : la page de confirmation attend et rattrape. */
            window.location.assign(retour);
            return { handled: true };
          } catch (e) {
            console.error("[whop elements] paiement", e);
            return echec(
              "Nous n'avons pas eu la réponse de votre banque. Ne recommencez pas tout de suite : si vous êtes débitée, votre confirmation s'affichera.",
            );
          }
        });
      })
      .catch(() => {
        if (!fini) onUnavailable("Le module de paiement Whop n'a pas pu se charger.");
      });

    return () => {
      fini = true;
      paiements?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  /*
    ── SURVEILLANCE DE LA COMMANDE ──
    Filet : si le webhook ou le rattrapage crée la commande pendant que la
    cliente est encore là, on l'emmène sur sa confirmation. 10 min maximum.
  */
  useEffect(() => {
    if (!session) return;
    let arrete = false;
    const debut = Date.now();
    const minuteur = setInterval(async () => {
      if (arrete || Date.now() - debut > 10 * 60 * 1000) {
        clearInterval(minuteur);
        return;
      }
      try {
        for (const id of [...new Set([session.sessionId, ...sessionsVues.current])].reverse()) {
          const { orderId } = await commandeDeLaSession(id);
          if (orderId && !arrete) {
            arrete = true;
            clearInterval(minuteur);
            clear();
            window.location.assign(`/order/${orderId}`);
            return;
          }
        }
      } catch {
        /* réseau capricieux : prochain battement */
      }
    }, 3000);
    return () => {
      arrete = true;
      clearInterval(minuteur);
    };
  }, [session, clear]);

  if (!session) {
    return (
      <p className="py-3 text-sm text-muted">
        {formValide
          ? "Préparation du paiement sécurisé…"
          : "Renseignez vos coordonnées de livraison ci-dessus : le paiement par carte s'affichera ensuite."}
      </p>
    );
  }

  return (
    <div>
      {!pret && <p className="py-3 text-sm text-muted">Chargement du paiement sécurisé…</p>}
      <div ref={zoneCarte} />
      <div ref={zoneMarque} className="mt-3" />

      {verification && (
        /*
          ⚠️ BANDEAU, PAS UN ÉCRAN PLEIN, et `pointer-events-none` : la fenêtre
          3-D Secure de la banque s'affiche par-dessus la page et doit rester
          cliquable.
        */
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/98 px-5 py-4 shadow-[0_-18px_40px_-24px_rgba(20,20,20,0.5)] backdrop-blur-sm sm:px-8"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-secondary">
                Paiement en cours — ne fermez pas cette page
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Votre banque vérifie le paiement. Votre confirmation s&apos;affichera
                automatiquement. Ne payez pas une seconde fois.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
