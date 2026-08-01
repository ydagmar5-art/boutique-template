"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import { useCart, cartTotal } from "@/lib/cart/store";
import { formatPrice } from "@/lib/products";
import { startCheckout } from "@/lib/actions/checkout";
import { embeddedPsp, type ConfirmFn } from "@/components/shop/payment/registry";
import PaymentBadges from "@/components/site/PaymentBadges";

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
  const total = cartTotal(lines);
  const confirm = useRef<ConfirmFn | null>(null);
  // Widget indisponible (script bloqué, clés invalides…) : on bascule sur la
  // page hébergée du PSP plutôt que de laisser le client sans solution.
  const [widgetDown, setWidgetDown] = useState(false);

  const entry = payment?.mode === "embedded" ? embeddedPsp(payment.id) : undefined;
  const psp = widgetDown ? undefined : entry;
  /** Widget tombé sans page hébergée de secours : on ne promet pas une
   *  redirection qui n'aboutirait pas. */
  const deadEnd = widgetDown && !entry?.hostedFallback;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payment) return;
    setError("");
    const fd = new FormData(e.currentTarget);
    const items = lines.map((l) => ({
      slug: l.slug,
      name: l.name,
      variantLabel: l.variantLabel,
      unitPrice: l.unitPrice,
      qty: l.qty,
    }));
    const draft = {
      customer: `${fd.get("firstName")} ${fd.get("lastName")}`.trim(),
      email: String(fd.get("email") || ""),
      address: `${fd.get("address")}, ${fd.get("zip")} ${fd.get("city")}`,
      items,
      total,
    };

    start(async () => {
      // ── Paiement sur place : le PSP encaisse sans quitter le site ──
      if (psp && confirm.current) {
        const res = await confirm.current({
          draft,
          amount: total,
          buyer: {
            firstName: String(fd.get("firstName") ?? ""),
            lastName: String(fd.get("lastName") ?? ""),
            email: draft.email,
            address: String(fd.get("address") ?? ""),
            city: String(fd.get("city") ?? ""),
            zip: String(fd.get("zip") ?? ""),
            countryCode: "FR",
          },
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        // Le PSP a pris la main sur la navigation (3-D Secure, retour propre) :
        // ne rien faire d'autre, surtout pas vider le panier.
        if (res.handled) return;
        if (!res.orderId) {
          setError("Le paiement a échoué.");
          return;
        }
        clear();
        router.push(`/order/${res.orderId}`);
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
        <form className="space-y-8" onSubmit={handleSubmit}>
          <section>
            <h2 className="mb-4 font-heading text-xl">Coordonnées</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prénom" name="firstName" />
              <Field label="Nom" name="lastName" />
              <Field label="E-mail" name="email" type="email" full />
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
                <span>🔒</span>
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
                  onReady={(fn) => {
                    confirm.current = fn;
                  }}
                  onUnavailable={() => setWidgetDown(true)}
                />
              )}
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
                  <span>🔒</span>
                  Vous allez être redirigé vers la page de paiement sécurisée{" "}
                  <strong>{payment.name}</strong> pour régler par carte.
                </p>
                <p className="mt-2 text-xs text-muted">
                  Aucune donnée bancaire ne transite par notre site.
                </p>
              </div>
            </section>
          )}

          {error && <p className="text-sm text-secondary">{error}</p>}

          <button
            type="submit"
            disabled={pending || !payment || deadEnd}
            className="w-full rounded-full bg-ink py-4 text-sm font-medium text-bg transition-all duration-300 hover:scale-[0.99] hover:bg-primary-dark disabled:opacity-60"
          >
            {pending ? "Traitement…" : `Payer ${formatPrice(total, brand.currency, brand.locale)}`}
          </button>

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
          <div className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            <Row label="Sous-total" value={formatPrice(total, brand.currency, brand.locale)} />
            <div className="flex items-center justify-between text-muted">
              <span>Livraison</span>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center rounded bg-[#FFCC00] px-1.5 py-0.5 text-[10px] font-bold italic text-[#D40511]">
                  DHL
                </span>
                <span className="font-medium text-organic">Offerte</span>
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="font-medium">Total</span>
            <span className="font-heading text-2xl">{formatPrice(total, brand.currency, brand.locale)}</span>
          </div>
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-xs text-muted">
            <span>🚚</span> Livraison offerte avec DHL · expédiée sous 24–48 h
          </p>
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

function Field({ label, name, type = "text", full }: { label: string; name: string; type?: string; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input name={name} type={type} required className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary" />
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
