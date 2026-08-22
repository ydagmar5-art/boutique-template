import "server-only";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import type { Order, OrderItem } from "@/lib/db/seed";
import { carrierLabel, trackingUrl } from "@/lib/carriers";
import { SOURCE_LABEL, type SourceVente } from "@/lib/attribution";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  E-MAILS TRANSACTIONNELS — direction « Galerie »                 ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Même registre que le site : blanc franc, angles droits, filets fins,
 * petites capitales espacées, une seule couleur d'accent (le noir).
 *
 * ⚠️ AUCUN ÉMOJI. Ni dans les objets, ni dans les corps. C'est une consigne
 * du gérant : un émoji dans un objet d'e-mail de maison de maroquinerie
 * fait « envoyé par un robot », et plusieurs filtres l'utilisent comme
 * signal promotionnel.
 *
 * ⚠️ HTML de courriel, pas de page web : tableaux, styles EN LIGNE, aucune
 * `flex`/`grid`, aucune police distante. Outlook rend encore via Word — une
 * feuille de style externe ou une variable CSS y disparaît sans bruit.
 */

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

/* ─────────────── Palette e-mail, alignée sur brand.colors ─────────────── */

const C = {
  page: "#F4F3F1", // fond hors carte, légèrement plus soutenu que le blanc
  surface: brand.colors.surface,
  bg: brand.colors.bg,
  ink: brand.colors.ink,
  muted: brand.colors.muted,
  line: brand.colors.border,
};

const SANS =
  "'Jost','Futura','Avenir Next',Helvetica,Arial,sans-serif";

/* ─────────────── Briques ─────────────── */

function itemsRows(items: OrderItem[]): string {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${C.line};">
          <div style="font-family:${SANS};font-size:12px;letter-spacing:2.4px;text-transform:uppercase;color:${C.ink};">${it.name}</div>
          <div style="font-family:${SANS};font-size:13px;color:${C.muted};margin-top:6px;">${it.variantLabel}${it.qty > 1 ? ` &middot; Quantité ${it.qty}` : ""}</div>
        </td>
        <td style="padding:16px 0;border-bottom:1px solid ${C.line};text-align:right;font-family:${SANS};font-size:14px;color:${C.ink};white-space:nowrap;vertical-align:top;">${money(it.unitPrice * it.qty)}</td>
      </tr>`,
    )
    .join("");
}

function orderCard(order: Order): string {
  if (!order.items.length) return "";
  const remise =
    order.subtotal && order.subtotal > order.total
      ? `
      <tr>
        <td style="padding:14px 0 0;font-family:${SANS};font-size:13px;color:${C.muted};">Sous-total</td>
        <td style="padding:14px 0 0;text-align:right;font-family:${SANS};font-size:13px;color:${C.muted};">${money(order.subtotal)}</td>
      </tr>
      ${(order.discounts ?? [])
        .map(
          (d) => `<tr>
        <td style="padding:6px 0 0;font-family:${SANS};font-size:13px;color:${C.muted};">${d.label}</td>
        <td style="padding:6px 0 0;text-align:right;font-family:${SANS};font-size:13px;color:${C.muted};">&minus;${money(d.amount)}</td>
      </tr>`,
        )
        .join("")}`
      : "";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 0;border-top:1px solid ${C.ink};">
    <tr><td style="padding:18px 0 4px;font-family:${SANS};font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:${C.muted};">
      Commande ${order.id}
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsRows(order.items)}</table>
    </td></tr>
    <tr><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${remise}
        <tr>
          <td style="padding:18px 0 0;font-family:${SANS};font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:${C.ink};">Total</td>
          <td style="padding:18px 0 0;text-align:right;font-family:${SANS};font-size:20px;font-weight:300;color:${C.ink};">${money(order.total)}</td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}

/** Encart « numéro de suivi » — vide si la commande n'en a pas. */
function trackingCard(order: Order): string {
  if (!order.tracking?.number) return "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border:1px solid ${C.line};">
    <tr><td style="padding:20px 22px;">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:${C.muted};">
        Suivi ${carrierLabel(order.tracking.carrier)}
      </div>
      <div style="font-family:'Courier New',monospace;font-size:19px;color:${C.ink};margin-top:8px;letter-spacing:1.5px;">
        ${order.tracking.number}
      </div>
    </td></tr>
  </table>`;
}

/**
 * Le mot sur le délai, dans l'e-mail d'expédition.
 *
 * ⚠️ CES DEUX AFFIRMATIONS SONT VRAIES — le gérant l'a confirmé le 5 août
 * 2026 : chaque article est examiné avant départ, et les envois sont
 * réellement groupés. Ne jamais transformer ce bloc en argument de façade :
 * une justification écologique inventée pour couvrir un délai qui vient
 * d'ailleurs est du greenwashing, devenu motif de contrôle prioritaire de la
 * DGCCRF. Si l'un des deux gestes cesse, cette section se retire.
 *
 * Le délai est ASSUMÉ, pas minimisé : annoncer sept à dix jours et les tenir
 * génère moins de réclamations qu'une promesse courte qu'on rate.
 */
function deliveryNote(): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;border-top:1px solid ${C.line};">
    <tr><td style="padding:24px 0 0;">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:${C.muted};">
        Le temps que nous prenons
      </div>
      <p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.muted};margin:14px 0 0;">
        Avant de quitter nos ateliers, votre pièce est passée à la loupe :
        la régularité des points, la tenue du fermoir, l'absence de marque
        sur le cuir. Ce qui ne passe pas cet examen ne part pas.
      </p>
      <p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.muted};margin:14px 0 0;">
        Nous regroupons ensuite nos envois plutôt que de multiplier les
        trajets. Un colis qui voyage accompagné pèse moins lourd sur la
        planète qu'un colis qui voyage seul.
      </p>
      <p style="font-family:${SANS};font-size:14px;line-height:1.8;color:${C.ink};margin:14px 0 0;">
        Ces deux gestes ajoutent quelques jours à votre attente : comptez
        sept à dix jours. Nous préférons vous les annoncer que vous les
        laisser découvrir.
      </p>
    </td></tr>
  </table>`;
}

/** Bouton rectangulaire noir — pas d'angles arrondis, comme sur le site. */
function button(label: string, url: string): string {
  if (!url) return "";
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 6px;"><tr>
    <td style="background:${C.ink};">
      <a href="${url}" style="display:inline-block;padding:16px 38px;font-family:${SANS};font-size:11px;letter-spacing:3.2px;text-transform:uppercase;color:${C.bg};text-decoration:none;">${label}</a>
    </td>
  </tr></table>`;
}

/** Monogramme M+R filaire, repris du site. Un SVG en e-mail ne passe pas
 *  partout : on redessine le lettrage en texte espacé, qui, lui, passe. */
function wordmark(): string {
  return `
  <div style="font-family:${SANS};font-size:15px;letter-spacing:6px;color:${C.ink};">${brand.name}</div>
  <div style="font-family:${SANS};font-size:8px;letter-spacing:5px;color:${C.muted};margin-top:6px;">PARIS</div>`;
}

/**
 * Gabarit commun.
 *
 * ⚠️ Le pied porte l'identité COMPLÈTE de l'exploitant (raison sociale,
 * numéro d'immatriculation, siège) : l'article 6 de la LCEN l'exige pour
 * toute communication commerciale, et les prestataires de paiement examinent
 * les e-mails transactionnels au même titre que le site.
 *
 * ⚠️ Pas de commentaire JSX dans les littéraux ci-dessous : ce sont des
 * chaînes, un `{/* … *\/}` y sortirait tel quel dans l'e-mail du client.
 */
function shell(opts: {
  preheader: string;
  badge: string;
  heading: string;
  intro: string;
  body?: string;
  cta?: { label: string; url: string };
}): string {
  return `
<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:36px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.surface};border:1px solid ${C.line};">
        <tr><td style="padding:34px 40px 0;" align="center">${wordmark()}</td></tr>

        <tr><td style="padding:34px 40px 0;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${C.muted};">${opts.badge}</div>
          <h1 style="font-family:${SANS};font-size:27px;line-height:1.22;font-weight:300;color:${C.ink};margin:18px 0 0;">${opts.heading}</h1>
          <p style="font-family:${SANS};font-size:15px;line-height:1.75;color:${C.muted};margin:18px 0 0;">${opts.intro}</p>
          ${opts.body ?? ""}
          ${opts.cta ? button(opts.cta.label, opts.cta.url) : ""}
        </td></tr>

        <tr><td style="padding:34px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            <tr>
              <td style="padding:16px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${C.muted};" width="34%">Livraison offerte</td>
              <td style="padding:16px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${C.muted};text-align:center;" width="33%">Paiement sécurisé</td>
              <td style="padding:16px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${C.muted};text-align:right;" width="33%">Retour sous 14 jours</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:26px 40px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            <tr><td style="padding:18px 0 0;font-family:${SANS};font-size:11px;line-height:1.75;color:${C.muted};">
              ${brand.legal.operator} &middot; ${brand.legal.registry.split(",")[0]} n° ${brand.legal.registrationNumber}<br>
              ${brand.legal.address}<br>
              <a href="mailto:${brand.contact.email}" style="color:${C.ink};text-decoration:none;">${brand.contact.email}</a>
              ${SITE ? ` &middot; <a href="${SITE}/livraison" style="color:${C.ink};text-decoration:none;">Livraison</a> &middot; <a href="${SITE}/remboursement" style="color:${C.ink};text-decoration:none;">Retours</a>` : ""}
            </td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-family:${SANS};font-size:10px;letter-spacing:1.5px;color:${C.muted};margin:18px 0 0;">
        &copy; ${new Date().getFullYear()} ${brand.name} PARIS
      </p>
    </td></tr>
  </table>
</body></html>`;
}

/* ─────────────── Événements client ─────────────── */

export async function sendOrderConfirmation(order: Order) {
  const first = order.customer.split(" ")[0] || "";
  await sendEmail({
    to: order.email,
    subject: `Votre commande ${order.id} est confirmée`,
    html: shell({
      preheader: `Nous préparons votre commande ${order.id}.`,
      badge: "Commande confirmée",
      heading: first ? `Merci ${first}.` : "Merci.",
      // ⚠️ On annonce ICI le délai d'EXPÉDITION (48 h), pas celui de
      // livraison : le détail des sept à dix jours appartient à l'e-mail
      // d'expédition, où il est expliqué. Charger la confirmation d'un délai
      // long refroidit une cliente qui vient de payer.
      intro:
        "Votre paiement a été accepté. Chaque pièce est examinée une dernière fois avant d'être emballée, puis confiée au transporteur sous quarante-huit heures. Vous recevrez son numéro de suivi dès son départ.",
      body: orderCard(order),
      cta: SITE ? { label: "Suivre ma commande", url: `${SITE}/order/${order.id}` } : undefined,
    }),
  });
}

export async function sendPaymentRefused(email: string, name: string, orderId?: string) {
  if (!email) return;
  await sendEmail({
    to: email,
    subject: "Votre paiement n'a pas abouti",
    html: shell({
      preheader: "Aucun montant n'a été débité.",
      badge: "Paiement non abouti",
      heading: name ? `Bonjour ${name},` : "Bonjour,",
      intro: `Votre paiement n'a pas pu être validé et <strong style="color:${C.ink};font-weight:400;">aucun montant n'a été débité</strong>${orderId ? ` (réf. ${orderId})` : ""}. Il s'agit le plus souvent d'un simple refus de la banque. Votre panier vous attend.`,
      cta: SITE ? { label: "Reprendre ma commande", url: `${SITE}/checkout` } : undefined,
    }),
  });
}

/**
 * Commande TRAITÉE — étape intermédiaire entre le paiement et l'expédition.
 *
 * Elle comble le silence le plus coûteux du parcours : entre « payé » et
 * « expédié », le client n'a aucune nouvelle et écrit au service client pour
 * demander où en est sa commande. Cet e-mail répond avant qu'il ne pose la
 * question, et annonce explicitement le suivant.
 *
 * ⚠️ AUCUN NUMÉRO DE SUIVI ICI : le colis n'est pas encore remis au
 * transporteur. Annoncer un suivi qui ne répond pas encore génère plus
 * d'inquiétude que pas de suivi du tout.
 */
export async function sendOrderProcessing(order: Order) {
  const first = order.customer.split(" ")[0] || "";
  return sendEmail({
    to: order.email,
    subject: `Votre commande ${order.id} est prête à partir`,
    html: shell({
      preheader: `Votre colis est préparé. Le suivi arrive à l'expédition.`,
      badge: "Commande traitée",
      heading: first ? `C'est prêt, ${first}.` : "C'est prêt.",
      intro:
        "Votre commande a été préparée et contrôlée : elle attend maintenant son passage au transporteur. Vous recevrez un second message avec le numéro de suivi dès qu'elle sera remise, pour la suivre jusqu'à votre porte.",
      body: orderCard(order),
      cta: SITE ? { label: "Voir ma commande", url: `${SITE}/order/${order.id}` } : undefined,
    }),
  });
}

export async function sendOrderShipped(order: Order) {
  const track = order.tracking ? trackingUrl(order.tracking) : "";
  return sendEmail({
    to: order.email,
    subject: `Votre commande ${order.id} est en route`,
    html: shell({
      preheader: order.tracking?.number
        ? `Suivi ${carrierLabel(order.tracking.carrier)} : ${order.tracking.number}`
        : "Votre commande a quitté nos ateliers.",
      badge: "Expédiée",
      heading: "Votre commande est partie.",
      intro: order.tracking?.number
        ? `Elle voyage avec <strong style="color:${C.ink};font-weight:400;">${carrierLabel(order.tracking.carrier)}</strong>. Voici le numéro qui vous permettra de la suivre jusqu'à votre porte.`
        : "Elle a quitté nos ateliers et arrive bientôt chez vous.",
      body: trackingCard(order) + deliveryNote() + orderCard(order),
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
      preheader: "Votre commande a été annulée.",
      badge: "Annulée",
      heading: "Votre commande a été annulée.",
      intro:
        "Si un paiement avait été effectué, il vous sera intégralement remboursé sous quelques jours ouvrés. Pour toute question, il suffit de répondre à cet e-mail.",
      body: orderCard(order),
    }),
  });
}

export async function sendOrderRefunded(order: Order) {
  await sendEmail({
    to: order.email,
    subject: `Remboursement de votre commande ${order.id}`,
    html: shell({
      preheader: "Votre remboursement est en cours.",
      badge: "Remboursée",
      heading: "Votre remboursement est en cours.",
      intro:
        "Le montant réapparaîtra sur votre moyen de paiement sous quelques jours ouvrés, selon votre banque.",
      body: orderCard(order),
    }),
  });
}

/* ─────────────── Bienvenue newsletter ─────────────── */

/**
 * ⚠️ Le code promo est écrit ici mais VALIDÉ côté serveur par le moteur
 * d'offres (`lib/promotions.ts`). Modifier ce texte ne crée aucun droit :
 * si le code est désactivé dans le back-office, il sera refusé au paiement.
 */
export async function sendNewsletterWelcome(email: string, code: string, percent: number) {
  return sendEmail({
    to: email,
    subject: `Bienvenue chez ${brand.name}`,
    html: shell({
      preheader: `Votre code de bienvenue : ${code}`,
      badge: "Bienvenue",
      heading: "Merci de nous suivre.",
      intro:
        "Vous serez prévenue en premier des nouvelles pièces et des rééditions. En attendant, voici de quoi commencer votre collection.",
      body: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;border:1px solid ${C.ink};">
        <tr><td style="padding:30px 22px;" align="center">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${C.muted};">Votre code de bienvenue</div>
          <div style="font-family:${SANS};font-size:30px;letter-spacing:9px;font-weight:300;color:${C.ink};margin-top:14px;">${code}</div>
          <div style="font-family:${SANS};font-size:13px;color:${C.muted};margin-top:14px;line-height:1.7;">
            ${percent}&nbsp;% sur votre première commande.<br>
            Cumulable avec les offres en cours, valable une fois.
          </div>
        </td></tr>
      </table>`,
      cta: SITE ? { label: "Découvrir la collection", url: `${SITE}/products` } : undefined,
    }),
  });
}

/* ─────────────── Notification gérant ─────────────── */

export async function sendMerchantNewOrder(order: Order) {
  const lignes = order.items
    .map(
      (it) =>
        `${it.name} &middot; ${it.variantLabel}${it.qty > 1 ? ` &times;${it.qty}` : ""} — ${money(it.unitPrice * it.qty)}`,
    )
    .join("<br>");

  await sendEmail({
    to: MERCHANT,
    subject: `Nouvelle vente ${order.id} — ${money(order.total)}`,
    html: shell({
      preheader: `${order.customer} &middot; ${money(order.total)}`,
      badge: "Nouvelle vente",
      heading: `${money(order.total)}`,
      intro: `${lignes}<br><br><strong style="color:${C.ink};font-weight:400;">${order.customer}</strong><br>${order.email}<br>${order.phone ? `${order.phone}<br>` : ""}${order.address || "Adresse non renseignée"}<br><br>Origine : ${SOURCE_LABEL[(order.source ?? "direct") as SourceVente] ?? order.source}<br>Réglé via ${order.psp}`,
      body: orderCard(order),
      cta: SITE ? { label: "Ouvrir le back-office", url: `${SITE}/admin/orders/${order.id}` } : undefined,
    }),
  });
}
