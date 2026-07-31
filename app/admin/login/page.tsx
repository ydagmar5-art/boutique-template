import { redirect } from "next/navigation";
import { brand } from "@/config/brand.config";
import { getSession } from "@/lib/auth/session";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-heading text-lg tracking-[0.2em]">{brand.name}</span>
        </div>
        <h1 className="font-heading text-2xl">Espace gestionnaire</h1>
        <p className="mt-1 text-sm text-muted">Connectez-vous pour continuer.</p>
        <AdminLoginForm />
      </div>
    </div>
  );
}
