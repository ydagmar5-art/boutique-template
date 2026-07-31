import "server-only";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import type { Order, OrderItem } from "@/lib/db/seed";
import { carrierLabel, trackingUrl } from "@/lib/carriers";

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || `${brand.name} <onboarding@resend.dev>`;
const REPLY_TO = brand.contact.email;
const MERCHANT = process.env.MERCHANT_EMAIL || brand.contact.email;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";

/** Envoi bas niveau via Resend. Ne lève jamais. */
async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!opts.to) return { ok: false, skipped: true };
  if (!KEY) {
    console.warn("[email] RESEND_API_KEY absent — non envoyé :", opts.subject);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        reply_to: REPLY_TO,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      console.error("[email] échec", res.status, await res.text());
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email]", e);
    return { ok: false };
  }
}

const money = (c: number) => formatPrice(c, brand.currency, brand.locale);

/* ─────────────── Design système e-mail (HTML inline, compatible clients) ─────────────── */

const C = {
  bg: "#FAF6EF",
  ink: "#2A2420",
  muted: "#7A6E5E",
  gold: "#B97A2E",
  line: "#E7DECF",
  surface: "#FFFFFF",
};

function itemsRows(items: OrderItem[]): string {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${C.line};">
          <div style="font-size:15px;color:${C.ink};font-weight:600;">${it.name}</div>
          <div style="font-size:13px;color:${C.muted};margin-top:2px;">${it.variantLabel} &middot; Quantité ${it.qty}</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid ${C.line};text-align:right;font-size:15px;color:${C.ink};white-space:nowrap;">${money(it.unitPrice * it.qty)}</td>
      </tr>`,
    )
    .join("");
}

function orderCard(order: Order): string {
  if (!order.items.length) return "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border-radius:14px;padding:8px 22px;margin:26px 0;">
    <tr><td style="padding-top:16px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};">
      Commande ${order.id} &middot; ${order.date}
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsRows(order.items)}</table>
    </td></tr>
    <tr><td style="padding:16px 0;">
      <table role="presentation" width="100%"><tr>
        <td style="font-size:16px;font-weight:700;color:${C.ink};">Total</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:22px;color:${C.ink};">${money(order.total)}</td>
      </tr></table>
    </td></tr>
  </table>`;
}

/** Encart « numéro de suivi » — vide si la commande n'en a pas. */
function trackingCard(order: Order): string {
  if (!order.tracking?.number) return "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-left:4px solid ${C.gold};border-radius:12px;margin:24px 0;">
    <tr><td style="padding:18px 22px;">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};">
        Suivi ${carrierLabel(order.tracking.carrier)}
      </div>
      <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:${C.ink};margin-top:6px;letter-spacing:1px;">
        ${order.tracking.number}
      </div>
    </td></tr>
  </table>`;
}

function button(label: string, url: string): string {
  if (!url) return "";
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>
    <td style="border-radius:999px;background:${C.ink};">
      <a href="${url}" style="display:inline-block;padding:14px 34px;font-size:14px;font-weight:600;color:${C.bg};text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr></table>`;
}

function shell(opts: {
  accent: string;
  badge: string;
  heading: string;
  intro: string;
  body?: string;
  cta?: { label: string; url: string };
}): string {
  return `
<!doctype html><html><body style="margin:0;background:${C.bg};">
  <div style="display:none;max-height:0;overflow:hidden;">${opts.heading}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.surface};border:1px solid ${C.line};border-radius:20px;overflow:hidden;">
        <!-- filet doré + logo -->
        <tr><td style="height:4px;background:${opts.accent};"></td></tr>
        <tr><td style="padding:26px 36px 0;">
          <span style="font-family:Georgia,serif;font-size:22px;letter-spacing:6px;color:${C.ink};">${brand.name}</span>
        </td></tr>
        <!-- corps -->
        <tr><td style="padding:22px 36px 8px;">
          <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${opts.accent};padding:5px 12px;border-radius:999px;background:${opts.accent}1A;">${opts.badge}</span>
          <h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.25;color:${C.ink};margin:16px 0 10px;font-weight:normal;">${opts.heading}</h1>
          <p style="font-size:15px;line-height:1.65;color:#5A5044;margin:0;">${opts.intro}</p>
          ${opts.body ?? ""}
          ${opts.cta ? button(opts.cta.label, opts.cta.url) : ""}
        </td></tr>
        <!-- réassurances -->
        <tr><td style="padding:20px 36px;">
          <table role="presentation" width="100%" style="border-top:1px solid ${C.line};padding-top:16px;font-size:12px;color:${C.muted};"><tr>
            <td>🚚 Livraison offerte</td><td style="text-align:center;">🔒 Paiement sécurisé</td><td style="text-align:right;">↩ Retour 30 jours</td>
          </tr></table>
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:18px 36px 26px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.muted};">
          ${brand.legal.operator} &middot; ${brand.legal.address}<br>
          Une question ? <a href="mailto:${brand.contact.email}" style="color:${C.gold};text-decoration:none;">${brand.contact.email}</a>
        </td></tr>
      </table>
      <p style="font-size:11px;color:${C.muted};margin:16px 0 0;">© ${new Date().getFullYear()} ${brand.name}</p>
    </td></tr>
  </table>
</body></html>`;
}

/* ─────────────── Événements client ─────────────── */

export async function sendOrderConfirmation(order: Order) {
  const first = order.customer.split(" ")[0] || "";
  await sendEmail({
    to: order.email,
    subject: `Votre commande ${order.id} est confirmée ✨`,
    html: shell({
      accent: "#9A9B7E",
      badge: "Paiement confirmé",
      heading: `Merci ${first}, c’est confirmé !`,
      intro:
        "Votre paiement a bien été accepté. Nous préparons votre commande avec le plus grand soin et vous préviendrons dès son expédition.",
      body: orderCard(order),
      cta: SITE ? { label: "Suivre ma commande", url: `${SITE}/order/${order.id}` } : undefined,
    }),
  });
}

export async function sendPaymentRefused(email: string, name: string, orderId?: string) {
  if (!email) return;
  await sendEmail({
    to: email,
    subject: "Votre paiement n’a pas abouti",
    html: shell({
      accent: "#BE6A47",
      badge: "Paiement non abouti",
      heading: `Bonjour ${name || ""}, votre paiement n’a pas pu être validé`,
      intro: `Aucun montant n’a été débité${orderId ? ` (réf. ${orderId})` : ""}. Il peut s’agir d’un simple refus de votre banque — vous pouvez réessayer en quelques secondes.`,
      cta: SITE ? { label: "Reprendre ma commande", url: `${SITE}/checkout` } : undefined,
    }),
  });
}

export async function sendOrderShipped(order: Order) {
  const track = order.tracking ? trackingUrl(order.tracking) : "";
  await sendEmail({
    to: order.email,
    subject: `Votre commande ${order.id} est en route 🚚`,
    html: shell({
      accent: "#D9954B",
      badge: "Expédiée",
      heading: "Votre commande vient de partir",
      intro: order.tracking?.number
        ? `Bonne nouvelle : votre commande a quitté notre atelier et voyage avec <strong>${carrierLabel(order.tracking.carrier)}</strong>. Voici votre numéro de suivi.`
        : "Bonne nouvelle : votre commande a quitté notre atelier et arrive bientôt chez vous. Merci de votre confiance.",
      body: trackingCard(order) + orderCard(order),
      // Le suivi transporteur prime sur le lien commande quand il existe.
      cta: track
        ? { label: "Suivre mon colis", url: track }
        : SITE
          ? { label: "Voir ma commande", url: `${SITE}/order/${order.id}` }
          : undefined,
    }),
  });
}

export async function sendOrderCancelled(order: Order) {
  await sendEmail({
    to: order.email,
    subject: `Votre commande ${order.id} a été annulée`,
    html: shell({
      accent: "#BE6A47",
      badge: "Annulée",
      heading: "Votre commande a été annulée",
      intro:
        "Si un paiement avait été effectué, il vous sera intégralement remboursé sous quelques jours. Pour toute question, répondez simplement à cet e-mail.",
      body: orderCard(order),
    }),
  });
}

export async function sendOrderRefunded(order: Order) {
  await sendEmail({
    to: order.email,
    subject: `Remboursement de votre commande ${order.id}`,
    html: shell({
      accent: "#9A9B7E",
      badge: "Remboursée",
      heading: "Votre remboursement est en cours",
      intro:
        "Nous avons procédé au remboursement de votre commande. Le montant réapparaîtra sur votre moyen de paiement sous quelques jours ouvrés.",
      body: orderCard(order),
    }),
  });
}

/* ─────────────── Notification gérant ─────────────── */

export async function sendMerchantNewOrder(order: Order) {
  await sendEmail({
    to: MERCHANT,
    subject: `🛎️ Nouvelle vente ${order.id} — ${money(order.total)}`,
    html: shell({
      accent: "#2A2420",
      badge: "Nouvelle vente",
      heading: `Nouvelle commande — ${money(order.total)}`,
      intro: `<strong>${order.customer}</strong> (${order.email})<br>Adresse : ${order.address || "—"}<br>Paiement : ${order.psp}`,
      body: orderCard(order),
      cta: SITE ? { label: "Ouvrir le back-office", url: `${SITE}/admin/orders/${order.id}` } : undefined,
    }),
  });
}
