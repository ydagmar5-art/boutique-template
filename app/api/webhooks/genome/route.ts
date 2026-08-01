import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { genomeCreds, genomeVerifyCallback } from "@/lib/payments/genome";
import { finalizeGenomePayment } from "@/lib/actions/checkout";
import type { GenomeCallback } from "@/lib/payments/genome";

export const dynamic = "force-dynamic";

/**
 * Callback serveur Genome — **seule** preuve d'encaissement.
 *
 * Genome n'expose pas d'API de statut sur la page hébergée : contrairement à
 * Fondy, impossible de revérifier le paiement après coup. C'est donc ce
 * callback qui crée la commande, et la vérification de signature est la seule
 * chose qui empêche n'importe qui de s'auto-attribuer des commandes payées.
 *
 * ⚠️ L'URL de ce point d'entrée ne se transmet pas dans la requête de paiement :
 * elle se déclare dans le tableau de bord Genome (Webhooks) :
 *     https://<domaine>/api/webhooks/genome
 */
export async function POST(req: Request) {
  const cfg = await getGatewayConfig("genome");
  const creds = genomeCreds(cfg?.credentials);
  if (!creds) {
    return NextResponse.json({ error: "Genome non configuré" }, { status: 400 });
  }

  // Corps BRUT : la signature porte sur les octets reçus. Le re-sérialiser
  // (JSON.parse puis JSON.stringify) suffirait à la faire échouer.
  const raw = await req.text();

  if (!genomeVerifyCallback(creds.apiSecret, raw, req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  let body: GenomeCallback;
  try {
    body = JSON.parse(raw) as GenomeCallback;
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  try {
    await finalizeGenomePayment(body);
  } catch (e) {
    console.error("Webhook Genome :", e);
  }
  // Toujours 200 : Genome réémet tant qu'il n'a pas d'accusé de réception.
  return NextResponse.json({ received: true });
}
