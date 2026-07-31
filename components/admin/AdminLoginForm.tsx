"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { login } from "@/lib/actions/auth";

export default function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-6 space-y-3"
      action={(fd) =>
        start(async () => {
          const res = await login(fd);
          if (res.ok) router.push("/admin");
          else setError(res.error);
        })
      }
    >
      <input
        name="email"
        type="email"
        required
        placeholder="E-mail"
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-primary"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="Mot de passe"
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-primary"
      />
      {error && <p className="text-sm text-secondary">{error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-full bg-ink py-3.5 text-sm font-medium text-bg hover:bg-primary-dark disabled:opacity-50"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
