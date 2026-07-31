import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { fondyCreds, fondyVerifyCallback } from "@/lib/payments/fondy";
import { finalizeFondyPayment } from "@/lib/actions/checkout";

export const dynamic = "force-dynamic";

/**
 * Callback serveur Fondy (`server_callback_url`) : filet de sécurité si le
 * client ferme l'onglet avant de revenir sur la boutique.
 *
 * L'URL est transmise à Fondy à chaque paiement — rien à configurer dans leur
 * back-office. Le corps est signé avec le mot de passe marchand ; une signature
 * invalide est rejetée sans rien créer. La création de commande passe par
 * `finalizeFondyPayment`, qui revérifie le statut auprès de Fondy et reste
 * idempotent (aucun doublon avec la page de retour).
 */
export async function POST(req: Request) {
  const cfg = await getGatewayConfig("fondy");
  const creds = fondyCreds(cfg?.credentials);
  if (!creds) {
    return NextResponse.json({ error: "Fondy non configuré" }, { status: 400 });
  }

  // Fondy poste soit du JSON, soit du form-urlencoded selon la configuration.
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    body = raw.trim().startsWith("{")
      ? JSON.parse(raw)
      : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  if (!fondyVerifyCallback(creds.password, body)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const orderId = String(body.order_id ?? "");
  if (!orderId) return NextResponse.json({ error: "order_id absent" }, { status: 400 });

  try {
    await finalizeFondyPayment(orderId);
  } catch (e) {
    console.error("Webhook Fondy :", e);
  }
  // Toujours 200 : Fondy réessaie tant qu'il ne reçoit pas d'accusé de réception.
  return NextResponse.json({ received: true });
}
