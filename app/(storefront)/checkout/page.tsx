import { brand } from "@/config/brand.config";
import { PAYMENT_PROVIDERS } from "@/lib/payments/providers";
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
    const kind =
      activeId === "test"
        ? "test"
        : activeId === "stripe"
        ? "stripe"
        : activeId === "square"
        ? "square"
        : activeId === "fondy"
        ? "fondy"
        : "other";

    active = {
      name: PAYMENT_PROVIDERS[activeId]?.name ?? activeId,
      kind,
    };

    // Stripe embarqué : la clé publishable est destinée au navigateur (la clé
    // secrète, elle, ne quitte jamais le serveur).
    if (activeId === "stripe") {
      const pk = saved.stripe?.values?.publicKey;
      if (pk) active.stripe = { publishableKey: pk };
    }

    // Square embarqué : appId + locationId (non-secrets) transmis au client.
    if (activeId === "square") {
      const v = saved.square?.values ?? {};
      if (v.applicationId && v.locationId) {
        active.square = {
          applicationId: v.applicationId,
          locationId: v.locationId,
          sandbox: saved.square?.mode !== "live",
        };
      }
    }
    // Fondy embarqué : seul le Merchant ID part au navigateur. Le mot de passe
    // marchand reste côté serveur (il signe le jeton de paiement).
    if (activeId === "fondy") {
      const merchantId = saved.fondy?.values?.merchantId;
      if (merchantId) active.fondy = { merchantId };
    }
  }

  // Un paiement PSP qui échoue renvoie le client ici avec ?error=… (Fondy).
  return <CheckoutClient payment={active} initialError={error ?? ""} />;
}
