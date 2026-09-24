import type { Metadata } from "next";
import ConfirmationWhop from "@/components/shop/ConfirmationWhop";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation du paiement", robots: { index: false } };

/**
 * Page d'arrivée de Whop Elements (`returnUrl`) : après un paiement réussi, ou
 * au retour d'un 3-D Secure. Elle attend la commande de la session et ouvre
 * la confirmation — voir `ConfirmationWhop`.
 */
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const texte = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <ConfirmationWhop
      sessionId={texte(params.s)}
      paymentId={[params.payment_id, params.payment, params.id].map(texte).find((v) => v.startsWith("pay_")) ?? ""}
      statut={texte(params.status || params.payment_status || params.redirect_status).toLowerCase()}
    />
  );
}
