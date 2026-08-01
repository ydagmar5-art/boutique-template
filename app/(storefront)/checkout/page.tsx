import { brand } from "@/config/brand.config";
import { PAYMENT_PROVIDERS } from "@/lib/payments/providers";
import { publicConfigFor } from "@/lib/payments/public-config";
import { getGateways } from "@/lib/actions/settings";
import CheckoutClient, { type ActivePayment } from "@/components/shop/CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const saved = await getGateways();
  const activeId = brand.payments.find((id) => saved[id]?.enabled);

  let active: ActivePayment | null = null;
  if (activeId) {
    const gateway = saved[activeId];
    // Un PSP s'affiche sur place s'il expose une config publique exploitable.
    // Clés incomplètes ou PSP sans champs hébergés (Genome) → redirection : le
    // repli est toujours le mode le plus sûr, jamais un widget mort.
    const config = publicConfigFor(
      activeId,
      gateway?.values,
      gateway?.mode === "live" ? "live" : "test",
      gateway?.secretsSet,
    );

    active = {
      id: activeId,
      name: PAYMENT_PROVIDERS[activeId]?.name ?? activeId,
      mode: activeId === "test" ? "test" : config ? "embedded" : "redirect",
      config: config ?? {},
    };
  }

  // Un paiement PSP qui échoue renvoie le client ici avec ?error=…
  return <CheckoutClient payment={active} initialError={error ?? ""} />;
}
