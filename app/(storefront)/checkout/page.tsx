import { brand } from "@/config/brand.config";
import { PAYMENT_PROVIDERS } from "@/lib/payments/providers";
import { publicConfigFor } from "@/lib/payments/public-config";
import { getGateways } from "@/lib/actions/settings";
import { reconcilierWhopSiNecessaire } from "@/lib/payments/reconciliation";
import CheckoutClient, { type ActivePayment } from "@/components/shop/CheckoutClient";

export const dynamic = "force-dynamic";

/**
 * ⚠️ ZOOM DÉSACTIVÉ SUR CETTE PAGE UNIQUEMENT.
 *
 * Sur iPhone, toucher un champ dont le texte fait moins de 16 px déclenche un
 * zoom automatique : la page grossit, déborde, et la cliente doit la faire
 * glisser de gauche à droite pour finir de saisir son adresse. Nos champs sont
 * passés à 16 px, mais ceux de la CARTE vivent dans l'iframe de Whop, dont nous
 * ne maîtrisons pas la typographie.
 *
 * Ce réglage verrouille donc l'échelle pour tout l'écran de paiement, iframe
 * comprise. Il ne s'applique qu'ici : sur les fiches produit et le reste du
 * site, le zoom au doigt reste disponible.
 */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  /* Rattrapage des ventes Whop encaissées sans commande : réveillé par le
     trafic, au plus une fois toutes les 5 minutes (cf. reconciliation.ts). */
  await reconcilierWhopSiNecessaire();
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
