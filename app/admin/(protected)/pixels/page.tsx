import { getPixels } from "@/lib/actions/pixels";
import PixelsForm from "@/components/admin/PixelsForm";

export const dynamic = "force-dynamic";

export default async function PixelsPage() {
  const pixels = await getPixels();
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-3xl">Pixels &amp; tracking</h1>
        <p className="mt-1 text-sm text-muted">
          Collez vos identifiants : les balises de suivi sont injectées
          automatiquement sur la boutique.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        Renseignez uniquement l&apos;identifiant de chaque plateforme (pas le code
        complet). Laissez vide pour désactiver. Pensez à respecter le consentement
        cookies de vos visiteurs (voir la{" "}
        <a href="/confidentialite" className="text-primary-dark hover:underline">
          politique de confidentialité
        </a>
        ).
      </div>

      <PixelsForm initial={pixels} />
    </div>
  );
}
