import { brand } from "@/config/brand.config";
import { PAYMENT_PROVIDERS } from "@/lib/payments/providers";
import { getGateways } from "@/lib/actions/settings";
import PaymentGatewayCard from "@/components/admin/PaymentGatewayCard";

export const dynamic = "force-dynamic";

export default async function AdminPayments() {
  const providers = brand.payments.map((id) => PAYMENT_PROVIDERS[id]).filter(Boolean);
  const saved = await getGateways();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-3xl">Passerelles de paiement</h1>
        <p className="mt-1 text-sm text-muted">
          Activez vos processeurs et saisissez vos clés API (Test ou Live).
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-organic/30 bg-organic/10 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-organic">🛡</span>
          <div className="text-sm">
            <p className="font-medium text-ink">Sécurité &amp; conformité PCI-DSS</p>
            <p className="mt-1 text-muted">
              {brand.name} n&apos;héberge ni ne stocke aucune donnée de carte bancaire. Chaque
              paiement utilise le SDK ou l&apos;élément hébergé officiel du processeur
              (tokenisation côté client). Vos clés secrètes sont conservées côté serveur
              et les webhooks sont vérifiés par signature.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {providers.map((p) => (
          <PaymentGatewayCard key={p.id} provider={p} initial={saved[p.id]} />
        ))}
      </div>
    </div>
  );
}
