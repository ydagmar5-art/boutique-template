import LiveVisitors from "@/components/admin/LiveVisitors";
import VisitorList from "@/components/admin/VisitorList";
import StatsExplorer from "@/components/admin/StatsExplorer";
import ConversionFunnel from "@/components/admin/ConversionFunnel";
import SalesSources from "@/components/admin/SalesSources";
import TopProduits from "@/components/admin/TopProduits";

export const dynamic = "force-dynamic";

export default function StatsPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-heading text-3xl">Statistiques</h1>
        <p className="text-sm text-muted">
          Audience en temps réel &amp; analyse par période
        </p>
      </header>

      <div className="space-y-6">
        <LiveVisitors />
        <StatsExplorer live />
        <ConversionFunnel />
        <TopProduits />
        <SalesSources />
        <VisitorList />
      </div>
    </div>
  );
}
