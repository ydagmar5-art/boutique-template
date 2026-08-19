import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { logout } from "@/lib/actions/auth";
import Sidebar from "@/components/admin/Sidebar";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");

  return (
    /*
      ⚠️ `min-w-0` sur la colonne de contenu : sans lui, un enfant large
      (tableau, graphique) impose sa largeur au conteneur flex, qui refuse de
      rétrécir — le contenu déborde alors sous le menu au lieu de défiler
      dans son propre cadre. C'est LA cause classique d'un back-office
      illisible sur téléphone.

      `pt-14 lg:pt-0` laisse la place à la barre mobile, qui est en `fixed`.
    */
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="min-w-0 flex-1 pt-14 lg:pt-0">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-8">
          <span className="truncate text-sm text-muted">
            Connecté · <span className="text-ink">{session.name}</span>
          </span>
          <form action={logout}>
            <button className="whitespace-nowrap text-sm text-muted hover:text-secondary">
              Déconnexion
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
