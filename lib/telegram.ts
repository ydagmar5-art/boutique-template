import "server-only";
import { brand } from "@/config/brand.config";
import { formatPrice } from "@/lib/products";
import type { Order } from "@/lib/db/seed";
import { SOURCE_LABEL, type SourceVente } from "@/lib/attribution";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  NOTIFICATION TELEGRAM DES VENTES                                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Prévient le groupe du gérant à chaque commande encaissée.
 *
 * ⚠️ NE LÈVE JAMAIS. Cette notification est un confort ; une panne de
 * Telegram, un bot retiré du groupe ou un jeton révoqué ne doivent en aucun
 * cas faire échouer la création de la commande — le client a déjà été
 * débité. L'appelant l'enveloppe d'ailleurs dans un `allSettled`.
 *
 * ⚠️ Sans `TELEGRAM_BOT_TOKEN` ni `TELEGRAM_CHAT_ID`, l'envoi est neutralisé
 * en silence (même politique que Resend) : une boutique clonée sans ces
 * variables ne doit pas cracher d'erreurs à chaque vente.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";

/** Échappe le HTML : un nom contenant « & » ou « < » casserait le message. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const money = (c: number) => formatPrice(c, brand.currency, brand.locale);

export async function sendTelegramSale(order: Order): Promise<{ ok: boolean }> {
  if (!TOKEN || !CHAT) return { ok: false };

  const articles = order.items
    .map(
      (it) =>
        `✨ ${esc(it.name)} — ${esc(it.variantLabel)}${it.qty > 1 ? ` (x${it.qty})` : ""}`,
    )
    .join("\n");

  const remise = order.subtotal && order.subtotal > order.total
    ? order.subtotal - order.total
    : 0;

  /*
    Structure et émojis demandés par le gérant.
    ⚠️ Ce sont les SEULS émojis de tout le projet : la consigne « aucun
    émoji » vaut pour la vitrine et les e-mails clients, pas pour cette
    notification interne, qui se lit d'un coup d'œil sur un téléphone.

    Le bloc PAIEMENT n'affiche sous-total et remise que s'il y a eu remise —
    répéter le même montant sur trois lignes ne renseigne sur rien.

    Parse mode HTML plutôt que Markdown : les noms de modèles et les
    adresses contiennent des tirets et des apostrophes que Markdown
    interpréterait comme du balisage.
  */
  const paiement = remise
    ? [
        `▫️ Sous-total : ${money(order.subtotal!)}`,
        `🏷️ Remise : -${money(remise)}`,
        `✅ TOTAL : ${money(order.total)}`,
      ]
    : [`✅ TOTAL : ${money(order.total)}`];

  const text = [
    `🛍️ <b>NOUVELLE VENTE : ${money(order.total)}</b> 🎉`,
    `📦 Commande #${esc(order.id)}`,
    ``,
    `🛒 <b>ARTICLE(S)</b>`,
    articles,
    ``,
    `💰 <b>PAIEMENT</b>`,
    ...paiement,
    ``,
    `👤 <b>CLIENT(E)</b>`,
    `👤 ${esc(order.customer)}`,
    `📧 ${esc(order.email)}`,
    order.phone ? `📱 ${esc(order.phone)}` : "",
    order.address ? `📍 ${esc(order.address)}` : "",
    ``,
    `📊 Origine : ${esc(SOURCE_LABEL[(order.source ?? "direct") as SourceVente] ?? order.source ?? "Direct")}`,
    `💳 Réglé via ${esc(order.psp)}`,
    SITE ? `🔗 ${SITE}/admin/orders/${encodeURIComponent(order.id)}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n")
    // Les lignes vides servent d'espacement : on les remet là où elles ont
    // été filtrées, sans jamais en empiler deux.
    .replace(/\n(🛒|💰|👤 <b>|💳)/g, "\n\n$1");

  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[telegram] échec", res.status, await res.text());
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[telegram]", e);
    return { ok: false };
  }
}

/**
 * Alerte technique adressée au gérant, en texte brut.
 *
 * Réservée aux situations qu'un journal serveur ne suffit pas à traiter :
 * typiquement un paiement encaissé que la boutique n'a pas su transformer en
 * commande. Personne ne lit les journaux de Vercel ; un message sur le
 * téléphone, si.
 *
 * ⚠️ Même politique que `sendTelegramSale` : ne lève jamais, et se neutralise
 * en silence sans jeton ni salon configurés.
 */
export async function sendTelegramAlert(message: string): Promise<{ ok: boolean }> {
  if (!TOKEN || !CHAT) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT,
        text: message,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok };
  } catch (e) {
    console.error("[telegram alerte]", e);
    return { ok: false };
  }
}
