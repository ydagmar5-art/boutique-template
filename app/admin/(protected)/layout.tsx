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
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden">
        <div className="flex items-center justify-between border-b border-line bg-surface px-8 py-3">
          <span className="text-sm text-muted">
            Connecté · <span className="text-ink">{session.name}</span>
          </span>
          <form action={logout}>
            <button className="text-sm text-muted hover:text-secondary">
              Déconnexion
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </div>
    </div>
  );
}
