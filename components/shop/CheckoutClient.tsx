"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import { useCart, cartTotal, sourceMemorisee } from "@/lib/cart/store";
import { formatPrice } from "@/lib/products";
import { startCheckout } from "@/lib/actions/checkout";
import { quoteCart } from "@/lib/actions/promotions";
import { pixelTrack } from "@/lib/pixel-events";
import type { AppliedDiscount } from "@/lib/promotions";
import { embeddedPsp, type ConfirmFn } from "@/components/shop/payment/registry";
import type { OrderItem } from "@/lib/db/seed";
import PaymentBadges from "@/components/site/PaymentBadges";
import Reassurances from "@/components/site/Reassurances";
import FrenchMark from "@/components/site/FrenchMark";
import TimelineLivraison from "./TimelineLivraison";

/** Récapitulatif chiffré par le serveur (seul juge du montant). */
interface Quote {
  subtotal: number;
  total: number;
  discounts: AppliedDiscount[];
  codeError?: string;
}

/**
 * Le PSP actif, tel que le serveur le décrit. Le checkout ne sait rien de
 * Stripe, Square ou Fondy en particulier : il sait seulement si le paiement se
 * règle sur place (`embedded`, cf. `components/shop/payment/registry.tsx`) ou
 * par redirection.
 */
export interface ActivePayment {
  id: string;
  name: string;
  mode: "test" | "embedded" | "redirect";
  /** Clés publiques du PSP (cf. `lib/payments/public-config.ts`). */
  config: Record<string, string | boolean>;
}

export default function CheckoutClient({
  payment,
  initialError = "",
}: {
  payment: ActivePayment | null;
  initialError?: string;
}) {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const [pending, start] = useTransition();
  const [error, setError] = useState(initialError);
  const localTotal = cartTotal(lines);
  const confirm = useRef<ConfirmFn | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /**
   * Vrai quand tous les champs obligatoires sont remplis.
   *
   * Sert de verrou aux boutons de portefeuille (Apple Pay) : ils ouvrent la
   * feuille de paiement d'un simple appui, sans passer par la validation du
   * formulaire. Les laisser accessibles trop tôt reviendrait à encaisser sans
   * savoir où expédier.
   */
  const [formValide, setFormValide] = useState(false);
  /** Code saisi, puis code réellement appliqué (validé par le serveur). */
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  /** E-mail saisi : sert à valider les codes « une fois par cliente ». */
  const [buyerEmail, setBuyerEmail] = useState("");
  /** Le serveur fait foi sur le montant : tant qu'il n'a pas répondu, on
   *  affiche la somme des articles, sans remise. */
  const total = quote?.total ?? localTotal;
  // Widget indisponible (script bloqué, clés invalides…) : on bascule sur la
  // page hébergée du PSP plutôt que de laisser le client sans solution.
  const [widgetDown, setWidgetDown] = useState(false);

  const entry = payment?.mode === "embedded" ? embeddedPsp(payment.id) : undefined;
  const psp = widgetDown ? undefined : entry;
  /** Widget tombé sans page hébergée de secours : on ne promet pas une
   *  redirection qui n'aboutirait pas. */
  const deadEnd = widgetDown && !entry?.hostedFallback;

  /**
   * Lignes envoyées au serveur. `variantId` est indispensable : c'est par lui
   * que le serveur retrouve la variante pour en recalculer le prix — le prix
   * unitaire ci-dessous, lui, ne sert qu'à l'affichage et sera écrasé.
   */
  const cartItems: OrderItem[] = lines.map((l) => ({
    slug: l.slug,
    name: l.name,
    variantId: l.variantId,
    variantLabel: l.variantLabel,
    unitPrice: l.unitPrice,
    qty: l.qty,
  }));

  /** Signature du panier : évite de réinterroger le serveur à chaque frappe. */
  const cartKey = lines
    .map((l) => `${l.slug}:${l.variantId}:${l.qty}`)
    .join("|");

  useEffect(() => {
    if (lines.length === 0) return setQuote(null);
    let cancelled = false;
    quoteCart(cartItems, code || undefined, buyerEmail || undefined).then((q) => {
      if (!cancelled && !q.error) setQuote(q as Quote);
    });
    return () => {
      cancelled = true;
    };
    // `cartItems` est reconstruit à chaque rendu : on ne réagit qu'à un vrai
    // changement de panier (via sa signature), de code appliqué, ou d'e-mail
    // saisi — ce dernier peut invalider un code « une fois par cliente ».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, code, buyerEmail]);

  /**
   * ── Événement « début de paiement » vers les régies ──
   *
   * Complète `AddToCart` (fiche produit) et `Purchase` (page de confirmation).
   * Sans lui, l'entonnoir des régies saute une marche : Snapchat et Meta ne
   * peuvent pas optimiser sur les visiteuses qui arrivent jusqu'ici, et le
   * taux d'abandon au paiement devient invisible côté publicité.
   *
   * ⚠️ On attend le devis SERVEUR avant d'envoyer, car l'offre « la 2e à
   * −40 % » s'applique côté serveur : partir sur le total local annoncerait
   * un montant supérieur à ce qui sera réellement encaissé, et fausserait la
   * valeur apprise par les algorithmes.
   *
   * ⚠️ Mais on part quand même après un court délai si le devis ne répond
   * pas : mieux vaut un montant approché qu'un événement jamais envoyé — une
   * marche manquante dans l'entonnoir est bien plus coûteuse.
   */
  const checkoutPixelEnvoye = useRef(false);
  useEffect(() => {
    if (checkoutPixelEnvoye.current || lines.length === 0) return;

    const envoyer = (montant: number) => {
      if (checkoutPixelEnvoye.current) return;
      checkoutPixelEnvoye.current = true;
      pixelTrack("InitiateCheckout", {
        value: montant / 100,
        items: lines.map((l) => ({
          id: l.slug,
          name: l.name,
          price: l.unitPrice / 100,
          quantity: l.qty,
        })),
      });
    };

    if (quote) return envoyer(quote.total);
    const repli = window.setTimeout(() => envoyer(localTotal), 1500);
    return () => window.clearTimeout(repli);
    // `lines` et `localTotal` sont lus au moment de l'envoi : seules la
    // présence d'articles et l'arrivée du devis doivent relancer l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length, quote]);

  /**
   * Brouillon construit à partir des champs du formulaire.
   *
   * ⚠️ Extrait de `handleSubmit` pour être réutilisable par les moyens de
   * paiement qui ont leur PROPRE bouton — Apple Pay en tête. Sans ça, un
   * paiement par portefeuille créerait une commande sans destinataire, alors
   * que la cliente vient précisément de saisir ses coordonnées au-dessus.
   */
  const construireDraft = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const items = cartItems;
    const firstName = String(fd.get("firstName") ?? "").trim();
    const lastName = String(fd.get("lastName") ?? "").trim();
    const street = String(fd.get("address") ?? "").trim();
    const zip = String(fd.get("zip") ?? "").trim();
    const city = String(fd.get("city") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    return {
      customer: `${firstName} ${lastName}`.trim(),
      email: String(fd.get("email") || ""),
      address: `${street}, ${zip} ${city}`,
      items,
      total,
      promoCode: code || undefined,
      source: sourceMemorisee(),
      firstName,
      lastName,
      phone,
      street,
      zip,
      city,
      country: "FR",
    };
  };

  /** Brouillon courant, ou `null` si un champ obligatoire manque encore. */
  const draftSiComplet = () => {
    const form = formRef.current;
    if (!form || !form.checkValidity()) return null;
    return construireDraft(form);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payment) return;
    setError("");
    const fd = new FormData(e.currentTarget);
    const items = cartItems;
    const firstName = String(fd.get("firstName") ?? "").trim();
    const lastName = String(fd.get("lastName") ?? "").trim();
    const street = String(fd.get("address") ?? "").trim();
    const zip = String(fd.get("zip") ?? "").trim();
    const city = String(fd.get("city") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const draft = {
      customer: `${firstName} ${lastName}`.trim(),
      email: String(fd.get("email") || ""),
      address: `${street}, ${zip} ${city}`,
      items,
      total,
      promoCode: code || undefined,
      source: sourceMemorisee(),
      /*
        Même identité, sous forme exploitable par les PSP : nom séparé du
        prénom, rue séparée du code postal. Sans elle, le processeur ne peut
        ni comparer l'adresse de livraison à celle de la carte, ni constituer
        un dossier de litige (cf. `lib/payments/identity.ts`).
      */
      firstName,
      lastName,
      phone,
      street,
      zip,
      city,
      country: "FR",
    };

    /*
      ╔══════════════════════════════════════════════════════════════════╗
      ║  APPLE PAY / GOOGLE PAY : LE GESTE UTILISATEUR NE SE DÉLÈGUE PAS ║
      ╚══════════════════════════════════════════════════════════════════╝

      ⚠️ `PaymentRequest.show()` — l'API par laquelle Apple Pay et Google Pay
      ouvrent leur feuille — n'est autorisée par le navigateur que pendant la
      brève « activation transitoire » consécutive à un clic. Cette activation
      ne survit pas à un `await` sur un appel réseau.

      Or le contrôle de prix ci-dessous est un aller-retour serveur. Le temps
      qu'il revienne, l'activation est perdue : `show()` est refusé en silence
      par le navigateur, Whop n'émet rien, et le bouton restait sur « Paiement
      en cours… » sans qu'aucune feuille ne s'ouvre. La carte, elle, n'exige
      aucun geste — d'où un tunnel qui marchait par carte et pas par Apple Pay.

      ⚠️ ON APPELLE DONC LE PSP EMBARQUÉ *AVANT* TOUT `await`. Ne jamais
      réintroduire d'appel réseau entre le clic et cette ligne.

      ⚠️ La sécurité du montant n'en dépend pas : `payWhop` recalcule le panier
      depuis le catalogue côté serveur et REFUSE la commande si Whop a encaissé
      autre chose (cf. `lib/actions/checkout.ts`). Le contrôle client n'était
      qu'un confort d'affichage.
    */
    if (psp && confirm.current) {
      const promesse = confirm.current({
        draft,
        amount: total,
        buyer: {
          firstName,
          lastName,
          email: draft.email,
          phone,
          address: street,
          city,
          zip,
          countryCode: "FR",
        },
      });
      start(async () => {
        const res = await promesse;
        if (res.error) {
          setError(res.error);
          return;
        }
        // Le PSP a pris la main sur la navigation : ne rien faire d'autre,
        // surtout pas vider le panier.
        if (res.handled) return;
        if (!res.orderId) {
          setError("Le paiement a échoué.");
          return;
        }
        clear();
        router.push(`/order/${res.orderId}`);
      });
      return;
    }

    start(async () => {
      /*
        🔒 LE MONTANT AFFICHÉ DOIT ÊTRE LE MONTANT DÉBITÉ.
        L'e-mail n'est remonté au serveur qu'à la sortie du champ. Une
        cliente qui saisit son adresse puis clique aussitôt sur Payer, sans
        que le champ ait perdu le focus, verrait encore la remise d'un code
        « une fois par cliente » que le serveur va refuser — et serait
        débitée plus que le total affiché.
        On revalide donc avec l'e-mail RÉELLEMENT saisi, et on s'arrête si
        le total a bougé, plutôt que d'encaisser une somme jamais montrée.
      */
      const controle = await quoteCart(items, code || undefined, draft.email);
      if (
        !controle.error &&
        typeof controle.total === "number" &&
        controle.total !== total
      ) {
        setQuote(controle as Quote);
        setBuyerEmail(draft.email);
        setError(
          "Le montant de votre commande vient d'être mis à jour. Vérifiez le récapitulatif avant de valider.",
        );
        return;
      }

      // ── Sinon : page de paiement hébergée du PSP ──
      const res = await startCheckout(draft);
      if (res.error || !res.url) {
        setError(res.error ?? "Impossible de démarrer le paiement.");
        return;
      }
      if (res.url.startsWith("/")) {
        clear();
        router.push(res.url);
      } else {
        window.location.href = res.url; // redirection PSP hébergé
      }
    });
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-32 text-center sm:px-8">
        <h1 className="font-heading text-3xl">Votre panier est vide</h1>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-full bg-ink px-8 py-3.5 text-sm font-medium text-bg hover:bg-primary-dark"
        >
          Voir la collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 md:py-16">
      <h1 className="mb-10 font-heading text-4xl">Paiement</h1>
      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
        <form
          ref={formRef}
          className="space-y-8"
          onSubmit={handleSubmit}
          /*
            ⚠️ TROIS déclencheurs, et ce n'est pas de la ceinture-bretelles :
            de cet état dépend l'AFFICHAGE MÊME du moyen de paiement (Whop) et
            du bouton Apple Pay. S'il restait faux, la cliente n'aurait aucun
            moyen de payer.

            · `onInput`  : la frappe, au caractère près — React n'émet `change`
                           qu'à la sortie du champ.
            · `onChange` : le remplissage automatique du navigateur, qui
                           n'émet pas toujours `input` (Safari notamment).
            · `onBlur`   : dernier filet, à la sortie de n'importe quel champ.
          */
          onInput={(e) => setFormValide(e.currentTarget.checkValidity())}
          onChange={(e) => setFormValide(e.currentTarget.checkValidity())}
          onBlur={(e) => setFormValide(e.currentTarget.checkValidity())}
        >
          <section>
            <h2 className="mb-4 font-heading text-xl">Coordonnées</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prénom" name="firstName" />
              <Field label="Nom" name="lastName" />
              {/*
                L'e-mail est remonté à la sortie du champ (pas à chaque
                frappe) : il sert à vérifier les codes « une fois par
                cliente », et interroger le serveur à chaque caractère
                n'apporterait rien.
              */}
              <Field
                label="E-mail"
                name="email"
                type="email"
                full
                onBlur={setBuyerEmail}
              />
              {/*
                Téléphone : demandé par le livreur (Colissimo l'utilise pour
                les avis de passage et la remise en point relais), et signal
                d'anti-fraude côté processeur de paiement. `type="tel"` ouvre
                le pavé numérique sur mobile ; le format reste libre, les
                clientes écrivent aussi bien « 06 12 34 56 78 » que
                « +33612345678 ».
              */}
              <Field
                label="Téléphone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="06 12 34 56 78"
                hint="Pour la livraison"
                full
              />
              <Field label="Adresse" name="address" full />
              <Field label="Code postal" name="zip" />
              <Field label="Ville" name="city" />
            </div>
          </section>

          {!payment ? (
            <div className="rounded-xl border border-dashed border-secondary/50 bg-secondary/5 p-6 text-sm text-secondary">
              Aucun moyen de paiement n&apos;est disponible pour le moment.
              Veuillez réessayer plus tard.
            </div>
          ) : payment.mode === "test" ? (
            <section>
              <SectionTitle />
              <div className="rounded-xl border border-line bg-surface p-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Numéro de carte</span>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-3">
                    <input inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" className="flex-1 bg-transparent text-sm outline-none" />
                    <span className="text-xs text-muted">VISA · MC</span>
                  </div>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">Expiration</span>
                    <input autoComplete="cc-exp" placeholder="MM / AA" className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-primary" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">CVC</span>
                    <input inputMode="numeric" autoComplete="cc-csc" placeholder="123" className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-primary" />
                  </label>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                Mode TEST : le paiement est validé automatiquement, aucun débit réel.
              </p>
            </section>
          ) : psp ? (
            <section>
              <SectionTitle />
              {/* Champs hébergés par le PSP : la carte part du navigateur
                  directement chez lui, sans passer par nos serveurs. */}
              {psp.framed ? (
                <div className="rounded-xl border border-line bg-surface p-4">
                  <psp.Fields
                    config={payment.config}
                    amount={total}
                    items={cartItems}
                    promoCode={code || undefined}
                    formValide={formValide}
                    getDraft={draftSiComplet}
                    onReady={(fn) => {
                      confirm.current = fn;
                    }}
                    onUnavailable={() => setWidgetDown(true)}
                  />
                </div>
              ) : (
                <psp.Fields
                  config={payment.config}
                  amount={total}
                  items={cartItems}
                  promoCode={code || undefined}
                  formValide={formValide}
                  getDraft={draftSiComplet}
                  onReady={(fn) => {
                    confirm.current = fn;
                  }}
                  onUnavailable={() => setWidgetDown(true)}
                />
              )}
              {/* Marque du prestataire qui encaisse RÉELLEMENT — jamais celle
                  d'un autre. Voir `BrandMark` dans le registre. */}
              {psp.BrandMark && <psp.BrandMark />}
            </section>
          ) : deadEnd ? (
            <section>
              <h2 className="mb-4 font-heading text-xl">Paiement indisponible</h2>
              <div className="rounded-xl border border-dashed border-secondary/50 bg-secondary/5 p-6 text-sm text-secondary">
                <p>
                  Le paiement par carte est momentanément indisponible. Merci de
                  réessayer dans quelques instants — votre panier est conservé.
                </p>
              </div>
            </section>
          ) : (
            <section>
              <h2 className="mb-4 font-heading text-xl">Paiement sécurisé</h2>
              <div className="rounded-xl border border-line bg-surface p-6 text-sm">
                <p className="flex items-center gap-2">
                  Vous allez être redirigé vers la page de paiement sécurisée{" "}
                  <strong>{payment.name}</strong> pour régler par carte.
                </p>
                <p className="mt-2 text-xs text-muted">
                  Aucune donnée bancaire ne transite par ce site.
                </p>
              </div>
            </section>
          )}

          {error && <p className="text-sm text-secondary">{error}</p>}

          {/*
            ⚠️ Un libellé « Traitement… » FIXE se lit comme un plantage : entre
            la tokenisation, le 3-D Secure et la création de la commande, il
            peut s'écouler plusieurs secondes pendant lesquelles rien ne bouge
            à l'écran. Le client reclique, ou pire, ferme l'onglet en pleine
            autorisation. D'où l'anneau animé + une phrase qui dit ce qui se
            passe et demande explicitement de ne pas fermer la page.
          */}
          <button
            type="submit"
            disabled={pending || !payment || deadEnd}
            aria-busy={pending}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-ink py-4 text-sm font-medium text-bg transition-all duration-300 hover:scale-[0.99] hover:bg-primary-dark disabled:opacity-60"
          >
            {pending && (
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full border-2 border-bg/30 border-t-bg motion-safe:animate-spin"
              />
            )}
            {pending
              ? "Paiement en cours…"
              : `Payer ${formatPrice(total, brand.currency, brand.locale)}`}
          </button>

          {pending && (
            <p
              role="status"
              className="text-center text-xs leading-relaxed text-muted"
            >
              Votre banque vérifie le paiement. Merci de ne pas fermer cette
              page ni recharger.
            </p>
          )}

          {/* Réassurances paiement */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <PaymentBadges />
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5 text-organic">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Paiement 100 % sécurisé · cryptage SSL
            </p>
          </div>
        </form>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-6">
          <h2 className="mb-5 font-heading text-xl">Votre commande</h2>

          {/*
            Rappel de l'offre au panier — mais UNIQUEMENT tant qu'elle n'est
            pas encore acquise. Une fois la remise appliquée, elle apparaît
            déjà dans le récapitulatif : la répéter ferait doublon et
            donnerait l'impression d'une double réduction.
          */}
          {brand.offer.short && lines.length === 1 && lines[0].qty === 1 && (
            <Link
              href="/products"
              className="mb-5 block border border-line px-4 py-3 text-center text-[0.68rem] leading-relaxed text-muted transition-colors hover:border-ink"
            >
              <span className="text-ink">{brand.offer.short}</span>
              <br />
              Continuer mes achats
            </Link>
          )}
          {/* Calendrier de livraison, au-dessus du récapitulatif.
              ⚠️ PAS d'appel à l'action ici : rien ne doit détourner du
              paiement une fois le client engagé dans le tunnel. */}
          <div className="mb-5">
            <TimelineLivraison compact />
          </div>

          <div className="space-y-4">
            {lines.map((l) => (
              <div key={`${l.slug}-${l.variantId}`} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.image} alt={l.name} className="h-16 w-14 rounded-lg object-cover" />
                <div className="flex flex-1 justify-between">
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted">{l.variantLabel} · ×{l.qty}</p>
                  </div>
                  <span className="text-sm">{formatPrice(l.unitPrice * l.qty, brand.currency, brand.locale)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* ── Code promo ── */}
          <div className="mt-5 border-t border-line pt-5">
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setCode(codeInput.trim());
                  }
                }}
                placeholder="Code promo"
                aria-label="Code promo"
                className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm uppercase outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setCode(codeInput.trim())}
                className="shrink-0 rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink"
              >
                Appliquer
              </button>
            </div>
            {quote?.codeError && (
              <p className="mt-2 text-xs text-secondary">{quote.codeError}</p>
            )}
          </div>

          <div className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            <Row
              label="Sous-total"
              value={formatPrice(quote?.subtotal ?? total, brand.currency, brand.locale)}
            />
            {quote?.discounts.map((d) => (
              <div
                key={d.promoId + (d.code ?? "")}
                className="flex items-start justify-between gap-3 text-organic"
              >
                <span className="min-w-0">
                  {d.label}
                  {d.code && (
                    <span className="ml-1.5 rounded bg-organic/10 px-1.5 py-0.5 font-mono text-[10px]">
                      {d.code}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap font-medium">
                  −{formatPrice(d.amount, brand.currency, brand.locale)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between text-muted">
              <span>Livraison</span>
              <span className="font-medium text-organic">
                {brand.shippingNote}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="font-medium">Total</span>
            <span className="font-heading text-2xl">{formatPrice(total, brand.currency, brand.locale)}</span>
          </div>
          {/*
            ⚠️ Le modèle annonçait ici « Livraison offerte avec DHL · expédiée
            sous 24–48 h », en dur. Un transporteur nommé et un délai chiffré
            sont des ENGAGEMENTS opposables : ils dépendent de la boutique, pas
            du moteur. La phrase vient donc de `brand.shippingDetail`.
          */}
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-xs text-muted">
            {brand.shippingDetail}
          </p>

          {/*
            Réassurances au moment de payer : c'est l'écran où le doute coûte
            le plus cher, et c'était le seul du tunnel à ne pas les porter.
          */}
          <div className="mt-6">
            <Reassurances variant="compact" />
          </div>
          <div className="mt-5 flex justify-center">
            <FrenchMark />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle() {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-heading text-xl">Paiement par carte</h2>
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-organic" />
        Sécurisé
      </span>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  full,
  onBlur,
  autoComplete,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  full?: boolean;
  onBlur?: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  /** Précision discrète à droite du libellé (« Pour la livraison »). */
  hint?: string;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        {hint && <span className="text-[11px] text-muted/70">{hint}</span>}
      </span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        onBlur={onBlur ? (e) => onBlur(e.currentTarget.value) : undefined}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition placeholder:text-muted/50 focus:border-primary"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
